const { assert, expect } = require("chai")
const { network, deployments, ethers } = require("hardhat")
const { Token } = require("nft.storage")
const { developmentChains } = require("../../helper-hardhat-config")

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("NftMarketplace Unit Testing", function () {
          let nftMarketplace, nftMarketplaceContract, basicNft, basicNftContract
          const PRICE = ethers.utils.parseEther("0.1")
          const LOWPRICE = ethers.utils.parseEther("0.09")
          const NEWPRICE = ethers.utils.parseEther("0.2")
          const TOKEN_ID = 0
          beforeEach(async function () {
              accounts = await ethers.getSigners()
              deployer = accounts[0]
              user = accounts[1]
              await deployments.fixture(["all"])
              nftMarketplaceContract = await ethers.getContract("NftMarketplace")
              nftMarketplace = await nftMarketplaceContract.connect(deployer)
              basicNftContract = await ethers.getContract("BasicNft")
              basicNft = await basicNftContract.connect(deployer)
              await basicNft.mintNft()
              await basicNft.approve(nftMarketplaceContract.address, TOKEN_ID)
          })

          describe("List item", function () {
              it("should emit event after listing", async function () {
                  expect(
                      await nftMarketplace.listItem(basicNftContract.address, TOKEN_ID, PRICE)
                  ).to.emit("ItemListed")
              })
              it("should not allow to list same item twice", async function () {
                  await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  const error = `AlreadyListed("${basicNft.address}", ${TOKEN_ID})`

                  await expect(
                      nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  ).to.be.revertedWith(error)
              })
              it("should only allow the owner to list", async function () {
                  const userConnectedToMarketplace = await nftMarketplaceContract.connect(user)
                  await basicNft.approve(user.address, TOKEN_ID)
                  await expect(
                      userConnectedToMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  ).to.be.revertedWith("NotOwner")
              })
              it("should need approval to list", async function () {
                  await basicNft.approve(ethers.constants.AddressZero, TOKEN_ID)
                  await expect(
                      nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  ).to.be.revertedWith("NotAprovedForMarketplace")
              })
              it("updates listing with seller and price", async function () {
                  await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  const listing = await nftMarketplace.getListing(basicNft.address, TOKEN_ID)
                  assert(listing.price.toString() == PRICE.toString())
                  assert(listing.seller.toString() == deployer.address)
              })
          })
          describe("cancelListing", function () {
              it("needs to be listed first", async function () {
                  const error = `NotListed("${basicNft.address}", ${TOKEN_ID});`
                  await expect(
                      nftMarketplace.cancelListing(basicNft.address, TOKEN_ID)
                  ).to.be.revertedWith("error")
              })
              it("should only let the owner cancel", async function () {
                  await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  const userNftMarketplace = nftMarketplace.connect(user)
                  await expect(
                      userNftMarketplace.cancelListing(basicNft.address, TOKEN_ID)
                  ).to.be.revertedWith("NftMarketplace__NotOwner")
              })
              it("should emit event and remove listing", async function () {
                  await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  expect(await nftMarketplace.cancelListing(basicNft.address, TOKEN_ID)).to.emit(
                      "ItemCanceled"
                  )
                  const listing = await nftMarketplace.getListing(basicNft.address, TOKEN_ID)
                  assert(listing.price.toString() == "0")
              })
          })

          describe("buyItem", function () {
              it("should revert if the item is not listed", async function () {
                  const error = `NftMarketplace__NotListed("${basicNft.address}", ${TOKEN_ID})`
                  const userNftMarketplace = nftMarketplace.connect(user)
                  await expect(
                      userNftMarketplace.buyItem(basicNft.address, TOKEN_ID)
                  ).to.be.revertedWith(error)
              })
              it("should revert if price is not met", async function () {
                  const error = `NftMarketplace__PriceNotMet("${basicNft.address}", ${TOKEN_ID}, ${PRICE})`
                  const userNftMarketplace = nftMarketplace.connect(user)
                  await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  await expect(
                      userNftMarketplace.buyItem(basicNft.address, TOKEN_ID, { value: LOWPRICE })
                  ).to.be.revertedWith(error)
              })
              it("should emit event once the item is bought", async function () {
                  const userNftMarketplace = nftMarketplace.connect(user)
                  await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  expect(
                      await userNftMarketplace.buyItem(basicNft.address, TOKEN_ID, { value: PRICE })
                  ).to.emit("ItemBought")
              })
              it("should update internal database and transfer NFT", async function () {
                  const userNftMarketplace = nftMarketplace.connect(user)
                  await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  await userNftMarketplace.buyItem(basicNft.address, TOKEN_ID, { value: PRICE })
                  const listing = await nftMarketplace.getListing(basicNft.address, TOKEN_ID)
                  assert(listing.price.toString() == "0")

                  const newOwner = await basicNft.ownerOf(TOKEN_ID)
                  assert(newOwner == user.address)

                  const proceeds = await nftMarketplace.getProceeds(deployer.address)
                  assert(proceeds.toString() == PRICE.toString())
              })
          })
          describe("updateListing", async function () {
              it("should revert if the item is not listed", async function () {
                  const error = `NftMarketplace__NotListed("${basicNft.address}", ${TOKEN_ID})`
                  await expect(
                      nftMarketplace.updateListing(basicNft.address, TOKEN_ID, NEWPRICE)
                  ).to.be.revertedWith(error)
              })
              it("should only let owner update", async function () {
                  await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  const userNftMarketplace = nftMarketplace.connect(user)
                  await expect(
                      userNftMarketplace.updateListing(basicNft.address, TOKEN_ID, NEWPRICE)
                  ).to.be.revertedWith("NotOwner")
              })
              it("should update the price with the new one", async function () {
                  await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  await nftMarketplace.updateListing(basicNft.address, TOKEN_ID, NEWPRICE)
                  const listing = await nftMarketplace.getListing(basicNft.address, TOKEN_ID)
                  assert(listing.price.toString() == NEWPRICE.toString())
              })
              it("should emit event once the item is updated", async function () {
                  await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  expect(
                      await nftMarketplace.updateListing(basicNft.address, TOKEN_ID, NEWPRICE)
                  ).to.emit("ItemListed")
              })
          })
          describe("withdrawProceeds", function () {
              it("should revert if proceeds value is <= 0", async function () {
                  await expect(nftMarketplace.withdrawProceeds()).to.be.revertedWith("NoProceeds")
              })
              it("should reset the proceeds and send the money", async function () {
                  const userNftMarketplace = nftMarketplace.connect(user)
                  await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  await userNftMarketplace.buyItem(basicNft.address, TOKEN_ID, { value: PRICE })

                  deployerProceedsBefore = await nftMarketplace.getProceeds(deployer.address)
                  deployerBalanceBefore = await deployer.getBalance()

                  const txResponse = await nftMarketplace.withdrawProceeds()
                  const txReceipt = await txResponse.wait(1)

                  const deployerBalanceAfter = await deployer.getBalance()
                  const deployerProceedsAfter = await nftMarketplace.getProceeds(deployer.address)

                  const { gasUsed, effectiveGasPrice } = txReceipt
                  const gasCost = gasUsed.mul(effectiveGasPrice)

                  assert(deployerProceedsBefore.toString() == PRICE.toString())
                  assert(deployerProceedsAfter.toString() == "0")

                  assert(
                      deployerBalanceAfter.add(gasCost).toString() ==
                          deployerBalanceBefore.add(deployerProceedsBefore).toString()
                  )
              })
          })
      })
