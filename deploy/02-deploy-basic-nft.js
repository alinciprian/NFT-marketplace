const { network } = require("hardhat")
const { developmentChains } = require("../helper-hardhat-config")
const { verify } = require("../utils/verify")

module.exports = async ({ deployments, getNamedAccounts }) => {
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()
    args = []

    const basicNft = await deploy("BasicNft", {
        from: deployer,
        args: args,
        log: true,
        waitConfirmations: network.config.waitConfirmations || 1,
    })

    if (!developmentChains.includes(network.name) && proccess.env.ETHEREUM_API_KEY) {
        log("Verifying...")
        await verify(basicNft.address, args)
    }
}

module.exports.tags = ["all", "basicNft"]
