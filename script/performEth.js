const hardhat = require("hardhat")
const {ethers} = require("hardhat");

const {
    lockerEth,tokenEth,limitEth,bridgeEth,lockerTop,tokenTop,minTransferedToken,maxTransferedToken,bridgeEthAddBolckAdmin,topInitBlock
} = require('./performparams')

//perform Eth
async function performEth(){
    await performLocker()
    await performLimit()
    await performTopBridge()
}

async function performLocker(){
    const { getNamedAccounts} = hardhat
    let {
    deployer
    } = await getNamedAccounts()

    console.log("+++++++++++++deployer+++++++++++++++ ", deployer)
    const signer = await ethers.provider.getSigner(deployer)

    console.log("+++++++++++++lockerEth+++++++++++++++ ", lockerEth)
    const locker = await ethers.getContractAt('ERC20Locker', lockerEth, signer)

    await locker.adminPause(0);
    await locker.bindAssetHash(tokenEth,tokenTop,lockerTop)
}

async function performLimit(){
    const { getNamedAccounts} = hardhat
    let {
    deployer
    } = await getNamedAccounts()
    const signer = await ethers.provider.getSigner(deployer)
    const limit = await ethers.getContractAt('Limit', limitEth, signer)
    await limit.bindTransferedQuota(tokenEth,minTransferedToken,maxTransferedToken)
}

async function performTopBridge(){
    const { getNamedAccounts} = hardhat
    let {
    deployer
    } = await getNamedAccounts()
    const signer = await ethers.provider.getSigner(deployer)
    const bridge = await ethers.getContractAt('TopBridge', bridgeEth, signer)
    await bridge.initWithBlock(topInitBlock)
    await bridge.grantRole('0xf36087c19d4404e16d698f98ed7d63f18bd7e07261603a15ab119b9c73979a86',bridgeEthAddBolckAdmin)
}

performEth()