const { expect } = require("chai");
const { call } = require('./helpers/call')
const hardhat = require('hardhat')
const { deployMockContract } = require('./helpers/deployMockContract')
const { AddressZero } = require("ethers").constants

const toWei = ethers.utils.parseEther

const overrides = { gasLimit: 9500000 }

describe('ERC20Locker', () => {

  let wallet, wallet2,wallet3
  let erc20Token,erc20Token2
  
  let erc20Locker
  
  let prover,bridge,limit

  beforeEach(async () => {
    [wallet, wallet2,wallet3] = await hardhat.ethers.getSigners()
    provider = hardhat.ethers.provider

    const Erc20token =  await hre.ethers.getContractFactory("ERC20Mintable", wallet, overrides)
    erc20Token = await Erc20token.deploy('ERC20Mintable', 'et')

    const Erc20token2 =  await hre.ethers.getContractFactory("ERC20Mintable", wallet, overrides)
    erc20Token2 = await Erc20token2.deploy('ERC20Mintable2', 'et2')

    const Erc20LockerResult =  await hre.ethers.getContractFactory("Erc20LockerTest", wallet, overrides)
    erc20Locker = await Erc20LockerResult.deploy()

    const TopBridge = await hre.artifacts.readArtifact("TopBridge")
    bridge = await deployMockContract(wallet, TopBridge.abi, overrides)

    const TopProver = await hre.ethers.getContractFactory("TopProver", wallet, overrides)
    prover = await TopProver.deploy(bridge.address)

    const Limit = await hre.ethers.getContractFactory("Limit", wallet, overrides)
    limit = await Limit.deploy()

    console.log("wallet>>>> "  + wallet.address)
    console.log("wallet2>>>> "  + wallet2.address)

    console.log("erc20Token>>>> "  + erc20Token.address)
    console.log("erc20Token2>>>> "  + erc20Token2.address)
    console.log("erc20Locker>>>> "  + erc20Locker.address)

    console.log("prover>>>> "  + prover.address)
    console.log("bridge>>>> "  + bridge.address)
    console.log("Limit>>>> "  + limit.address)

    await erc20Locker._ERC20Locker_initialize(prover.address,0,wallet.address,limit.address)

  })

  //bindAssetHash
  describe('bindAssetHash', () => {
    it('It has permissions', async () => {
      await erc20Locker.bindAssetHash(erc20Token.address, erc20Token2.address,erc20Token2.address);
    })

    it('It has no permissions', async () => {
      let msg = 'AccessControl: account ' + wallet2.address.toLowerCase() + ' is missing role 0x0eddb5b75855602b7383774e54b0f5908801044896417c7278d8b72cd62555b6'
      await expect(erc20Locker.connect(wallet2).bindAssetHash(erc20Token.address, erc20Token2.address,erc20Token2.address)
      ).to.be.revertedWith(msg)
    })

    it('It is bind empty address', async () => {
      await expect(erc20Locker.bindAssetHash(AddressZero, erc20Token2.address,erc20Token2.address)).to.be.revertedWith('both asset addresses are not to be 0')

    })
  })

  //lockToken
  describe('lockToken', () => {
    it('no have bind token', async () => {
      await limit.bindTransferedQuota(erc20Token.address,toWei('10'),toWei('400'))
      await expect(erc20Locker.lockToken(erc20Token.address,toWei('100'),wallet3.address)).to.be.revertedWith('empty illegal toAssetHash')
    })

    it('have bind token but without balance', async () => {
      await erc20Token.mint(wallet3.address,toWei('200'))

      expect(await erc20Token.balanceOf(wallet3.address)).to.equal(toWei('200'));
      await erc20Locker.bindAssetHash(erc20Token.address, erc20Token2.address,erc20Token2.address);
      await limit.bindTransferedQuota(erc20Token.address,toWei('10'),toWei('400'))
      await expect(erc20Locker.lockToken(erc20Token.address,toWei('100'),wallet3.address)).to.be.revertedWith('ERC20: insufficient allowance')

    })

    it('without approve', async () => {
      await erc20Token.mint(wallet.address,toWei('200'))
      await erc20Token.mint(wallet3.address,toWei('200'))

      expect(await erc20Token.balanceOf(wallet3.address)).to.equal(toWei('200'));

      await erc20Locker.bindAssetHash(erc20Token.address, erc20Token2.address,erc20Token2.address);
      await limit.bindTransferedQuota(erc20Token.address,toWei('10'),toWei('400'))
      await expect(erc20Locker.lockToken(erc20Token.address,toWei('100'),wallet3.address)).to.be.revertedWith('ERC20: insufficient allowance')
    })

    it('pause and have no permissions', async () => {
      await erc20Token.mint(wallet.address,toWei('200'))
      await erc20Token.mint(wallet3.address,toWei('200'))

      expect(await erc20Token.balanceOf(wallet3.address)).to.equal(toWei('200'));

      await erc20Locker.bindAssetHash(erc20Token.address, erc20Token2.address,erc20Token2.address);
      await erc20Token.approve(erc20Locker.address,toWei('200'))

      await erc20Locker.adminPause(255)
      expect(await erc20Locker.paused()).to.equal(255);

      await erc20Locker.revokeRole('0x8f2157482fb2324126e5fbc513e0fe919cfa878b0f89204823a63a35805d67de',wallet.address)
      expect(await erc20Locker.hasRole('0x8f2157482fb2324126e5fbc513e0fe919cfa878b0f89204823a63a35805d67de',wallet.address)).to.equal(false);
    
      await expect(erc20Locker.lockToken(erc20Token.address,toWei('100'),wallet3.address)).to.be.revertedWith('has been pause')

    })

    it('pause and have permissions', async () => {
      await erc20Token.mint(wallet.address,toWei('200'))
      await erc20Token.mint(wallet3.address,toWei('200'))

      expect(await erc20Token.balanceOf(wallet3.address)).to.equal(toWei('200'));

      await erc20Locker.bindAssetHash(erc20Token.address, erc20Token2.address,erc20Token2.address);
      await erc20Token.approve(erc20Locker.address,toWei('200'))

      await limit.bindTransferedQuota(erc20Token.address,toWei('10'),toWei('400'))
      await erc20Locker.lockToken(erc20Token.address,toWei('100'),wallet3.address)

    })
    
    it('pause and have no permissions', async () => {
      await erc20Token.mint(wallet.address,toWei('200'))
      await erc20Token.mint(wallet3.address,toWei('200'))

      expect(await erc20Token.balanceOf(wallet3.address)).to.equal(toWei('200'));
      await erc20Locker.bindAssetHash(erc20Token.address, erc20Token2.address,erc20Token2.address);
      await erc20Token.approve(erc20Locker.address,toWei('200'))
    
      await erc20Locker.revokeRole('0x8f2157482fb2324126e5fbc513e0fe919cfa878b0f89204823a63a35805d67de',wallet.address)
      expect(await erc20Locker.hasRole('0x8f2157482fb2324126e5fbc513e0fe919cfa878b0f89204823a63a35805d67de',wallet.address)).to.equal(false);
     
      await expect(erc20Locker.lockToken(erc20Token.address,toWei('100'),wallet3.address)).to.be.revertedWith('has been pause')

    })
    
    it('settings can pass and have no permissions', async () => {
      await erc20Token.mint(wallet.address,toWei('200'))
      await erc20Token.mint(wallet3.address,toWei('200'))

      expect(await erc20Token.balanceOf(wallet3.address)).to.equal(toWei('200'));
      await erc20Locker.bindAssetHash(erc20Token.address, erc20Token2.address,erc20Token2.address);

      await erc20Locker.adminPause(0)

      expect(await erc20Locker.paused()).to.equal(0);

      await limit.bindTransferedQuota(erc20Token.address,toWei('10'),toWei('400'))

      await erc20Token.approve(erc20Locker.address,toWei('200'))

      await erc20Locker.revokeRole('0x8f2157482fb2324126e5fbc513e0fe919cfa878b0f89204823a63a35805d67de',wallet.address)
      expect(await erc20Locker.hasRole('0x8f2157482fb2324126e5fbc513e0fe919cfa878b0f89204823a63a35805d67de',wallet.address)).to.equal(false);
      
      erc20Locker.lockToken(erc20Token.address,toWei('100'),wallet3.address)

    })

    it('settings can pass and have permissions', async () => {
      await erc20Token.mint(wallet.address,toWei('200'))
      await erc20Token.mint(wallet3.address,toWei('200'))

      expect(await erc20Token.balanceOf(wallet3.address)).to.equal(toWei('200'));
      await erc20Locker.bindAssetHash(erc20Token.address, erc20Token2.address,erc20Token2.address);

      await erc20Token.approve(erc20Locker.address,toWei('200'))

      await erc20Locker.adminPause(0)

      expect(await erc20Locker.paused()).to.equal(0);

      await limit.bindTransferedQuota(erc20Token.address,toWei('10'),toWei('400'))
      await erc20Locker.lockToken(erc20Token.address,toWei('100'),wallet3.address)

      expect(await erc20Token.balanceOf(erc20Locker.address)).to.equal(toWei('100'));

    })

    it('There is no set lock amount limit', async () => {
      await erc20Token.mint(wallet.address,toWei('200'))
      await erc20Token.mint(wallet3.address,toWei('200'))

      expect(await erc20Token.balanceOf(wallet3.address)).to.equal(toWei('200'));
      await erc20Locker.bindAssetHash(erc20Token.address, erc20Token2.address,erc20Token2.address);

      await erc20Token.approve(erc20Locker.address,toWei('200'))
    
      await erc20Locker.adminPause(0)

      expect(await erc20Locker.paused()).to.equal(0);

      await expect(erc20Locker.lockToken(erc20Token.address,toWei('50'),wallet3.address)).to.be.revertedWith('quota is not exist')

    })

    it('Minimum lock amount limit', async () => {

      await erc20Token.mint(wallet.address,toWei('200'))
      await erc20Token.mint(wallet3.address,toWei('200'))

      expect(await erc20Token.balanceOf(wallet3.address)).to.equal(toWei('200'));
      await erc20Locker.bindAssetHash(erc20Token.address, erc20Token2.address,erc20Token2.address);

      await erc20Token.approve(erc20Locker.address,toWei('200'))
    
      await erc20Locker.adminPause(0)

      expect(await erc20Locker.paused()).to.equal(0);

      await limit.bindTransferedQuota(erc20Token.address,toWei('100'),toWei('400'))

      await expect(erc20Locker.lockToken(erc20Token.address,toWei('50'),wallet3.address)).to.be.revertedWith('amount of token is underflow')

    })

    it('Maximum lock amount limit', async () => {

      await erc20Token.mint(wallet.address,toWei('200'))
      await erc20Token.mint(wallet3.address,toWei('200'))

      expect(await erc20Token.balanceOf(wallet3.address)).to.equal(toWei('200'));
      await erc20Locker.bindAssetHash(erc20Token.address, erc20Token2.address,erc20Token2.address);

      await erc20Token.approve(erc20Locker.address,toWei('200'))
    
      await erc20Locker.adminPause(0)

      expect(await erc20Locker.paused()).to.equal(0);

      await limit.bindTransferedQuota(erc20Token.address,toWei('100'),toWei('150'))

      await expect(erc20Locker.lockToken(erc20Token.address,toWei('180'),wallet3.address)).to.be.revertedWith('amount of token is overflow')

    })

    it('account set blacklist', async () => {

      await erc20Token.mint(wallet.address,toWei('200'))
      await erc20Token.mint(wallet3.address,toWei('200'))

      expect(await erc20Token.balanceOf(wallet3.address)).to.equal(toWei('200'));

      await erc20Locker.bindAssetHash(erc20Token.address, erc20Token2.address,erc20Token2.address);
      await erc20Token.approve(erc20Locker.address,toWei('200'))
      await limit.bindTransferedQuota(erc20Token.address,toWei('100'),toWei('400'))

      await erc20Locker.grantRole('0x7f600e041e02f586a91b6a70ebf1c78c82bed96b64d484175528f005650b51c4',wallet2.address)
      expect(await erc20Locker.hasRole('0x7f600e041e02f586a91b6a70ebf1c78c82bed96b64d484175528f005650b51c4',wallet2.address)).to.equal(true);
      await expect(erc20Locker.connect(wallet2).lockToken(erc20Token.address,toWei('100'),wallet3.address)).to.be.revertedWith('has been pause')

    })
   })

   //setConversionDecimalsAssets
  describe('setConversionDecimalsAssets', () => {
    it('It is the owner', async () => {
      await erc20Locker.setConversionDecimalsAssets(erc20Token.address,6)
      let conversionDecimalsAssets = await erc20Locker.conversionDecimalsAssets(erc20Token.address);
      console.log("conversionDecimalsAssets>>>> "  + conversionDecimalsAssets)
      expect(conversionDecimalsAssets.fromDecimals).to.equal(18);
      expect(conversionDecimalsAssets.toDecimals).to.equal(6);
    })

    it('It is not the owner', async () => {
      let msg = 'AccessControl: account ' + wallet2.address.toLowerCase() + ' is missing role 0x0eddb5b75855602b7383774e54b0f5908801044896417c7278d8b72cd62555b6'
      await expect(erc20Locker.connect(wallet2).setConversionDecimalsAssets(erc20Token.address,6))
      .to.be.revertedWith(msg)
    })

    it('The accuracy of to is greater than that of FROM', async () => {
      await expect(erc20Locker.setConversionDecimalsAssets(erc20Token.address,20))
      .to.be.revertedWith('invalid the decimals')
          
      })

    it('The accuracy of to is equal to that of FROM', async () => {
        await expect(erc20Locker.setConversionDecimalsAssets(erc20Token.address,18))
        .to.be.revertedWith('invalid the decimals')
            
    })  
        
    it('The accuracy of to is 0', async () => {
      await expect(erc20Locker.setConversionDecimalsAssets(erc20Token.address,0))
      .to.be.revertedWith('invalid the decimals')
          
    })

    it('The accuracy of to is greater than 256', async () => {
      try{
        await expect(erc20Locker.setConversionDecimalsAssets(erc20Token.address,1000))
        .to.be.revertedWith('value out-of-bounds')
      }catch{}
    })
  })
    
  //conversionFromAssetAmount
  describe('conversionFromAssetAmount', () => {
    it('The normal conversion is lock', async () => {
      await erc20Locker.setConversionDecimalsAssets(erc20Token.address,6)
      let returenAmounts = await erc20Locker.conversionFromAssetAmountTest2(erc20Token.address,toWei('100'),true)
      expect(returenAmounts[0]).to.equal(toWei('100'));
      expect(returenAmounts[1]).to.equal(toWei('0.0000000001'));

    })

    it('The normal conversion not is lock', async () => {
      await erc20Locker.setConversionDecimalsAssets(erc20Token.address,6)
      let returenAmounts = await erc20Locker.conversionFromAssetAmountTest2(erc20Token.address,toWei('0.0000000001'),false)
      expect(returenAmounts[0]).to.equal(toWei('100'));
      expect(returenAmounts[1]).to.equal(toWei('0.0000000001'));

    })

    it('Invalid the conversionAmount', async () => {
      await erc20Locker.setConversionDecimalsAssets(erc20Token.address,6)
      await expect(erc20Locker.conversionFromAssetAmountTest1(erc20Token.address,1,true))
      .to.be.revertedWith('invalid the conversionAmount')

    })

    it('Invalid the conversionAmount', async () => {
      await erc20Locker.setConversionDecimalsAssets(erc20Token.address,6)
      await expect(erc20Locker.conversionFromAssetAmountTest1(erc20Token.address,toWei('0.00000001'),true))
      .to.be.revertedWith('invalid the conversionAmount')

    })

  })

   //lockToken
  describe('lockToken', () => {
    it('Set the precision to convert it to an integer', async () => {
      await erc20Token.mint(wallet.address,toWei('200'))
      await erc20Token.mint(wallet3.address,toWei('200'))

      expect(await erc20Token.balanceOf(wallet3.address)).to.equal(toWei('200'));

      await erc20Locker.bindAssetHash(erc20Token.address, erc20Token2.address,erc20Token2.address);
      await erc20Token.approve(erc20Locker.address,toWei('200'))

      await limit.bindTransferedQuota(erc20Token.address,toWei('10'),toWei('400'))
      
      await erc20Locker.setConversionDecimalsAssets(erc20Token.address,6)

      let conversionDecimalsAssets = await erc20Locker.conversionDecimalsAssets(erc20Token.address);

      expect(conversionDecimalsAssets.fromDecimals).to.equal(18);
      expect(conversionDecimalsAssets.toDecimals).to.equal(6);
      //emit Locked(fromAssetHash, toAssetHash, msg.sender, eventAmount, receiver)
      await expect(erc20Locker.lockToken(erc20Token.address,toWei('100'),wallet3.address)).to.emit(erc20Locker,'Locked')
      .withArgs(erc20Token.address, erc20Token2.address,wallet.address,toWei('0.0000000001'),wallet3.address)
      expect(await erc20Token.balanceOf(erc20Locker.address)).to.equal(toWei('100'));

    })

    it('Set the precision to convert it to a decimal', async () => {
      await erc20Token.mint(wallet.address,toWei('200'))
      await erc20Token.mint(wallet3.address,toWei('200'))
      expect(await erc20Token.balanceOf(wallet3.address)).to.equal(toWei('200'));
      await erc20Locker.bindAssetHash(erc20Token.address, erc20Token2.address,erc20Token2.address);
      await erc20Token.approve(erc20Locker.address,toWei('200'))

      await limit.bindTransferedQuota(erc20Token.address,toWei('0'),toWei('400'))
      
      await erc20Locker.setConversionDecimalsAssets(erc20Token.address,6)

      let conversionDecimalsAssets = await erc20Locker.conversionDecimalsAssets(erc20Token.address);

      expect(conversionDecimalsAssets.fromDecimals).to.equal(18);
      expect(conversionDecimalsAssets.toDecimals).to.equal(6);
      //emit Locked(fromAssetHash, toAssetHash, msg.sender, eventAmount, receiver)
      await expect(erc20Locker.lockToken(erc20Token.address,toWei('1.1234567891'),wallet3.address)).to.emit(erc20Locker,'Locked')
      .withArgs(erc20Token.address, erc20Token2.address,wallet.address,1123456,wallet3.address)

      expect(await erc20Token.balanceOf(wallet.address)).to.equal(toWei('198.876544'));
      expect(await erc20Token.balanceOf(erc20Locker.address)).to.equal(toWei('1.123456'));


    })
   })
 
   //unlockToken
   //test1
   /**
    * erc20
      +++++++++++++ERC20TokenSample+++++++++++++++  0x717395aA760819A4EF9023bB4ca0c73f6C886c4f
      +++++++++++++ERC20Locker+++++++++++++++  0xB596a8BFbB0f52b5355b20Eb32051E69b5195AC3
      +++++++++++++LimitResult+++++++++++++++  0x45a70Ef72c6CB42E8159114Db65c049165091fdb
      +++++++++++++TopBridge+++++++++++++++  0x3DB1a16518b9cd4e7E8128C5B5684bE433e5fbde
      +++++++++++++TopProver+++++++++++++++  0xb7EC0276Bd7eaC4B93E45FaA852729327468E57E

      top
      +++++++++++++ERC20TokenSample+++++++++++++++  0xA3F5a3af9Fd0243c54a263C2ACB4B400673Ea7c6
      +++++++++++++ERC20Locker+++++++++++++++  0x242dFD130f39268F8b1b5Dc760406a4Cf90b1b73
      +++++++++++++LimitResult+++++++++++++++  0x465370F902bAe111204D56F5bDb825369b6b0Ba4
      +++++++++++++TopProver+++++++++++++++  0xB5E47E0D05f249db17B9e26e854F2349695656A5
      burn proof 0x0100000000000000df000000f8dd94242dfd130f39268f8b1b5dc760406a4cf90b1b73f884a04f89ece0f576ba3986204ba19a44d94601604b97cf3baa922b010a758d303842a0000000000000000000000000a3f5a3af9fd0243c54a263c2acb4b400673ea7c6a0000000000000000000000000717395aa760819a4ef9023bb4ca0c73f6c886c4fa00000000000000000000000001ba30ee006f456615044415c5c84b2fd430525e2b840000000000000000000000000000000000000000000000000000000000bebc2000000000000000000000000005710d43f700e8292ce83e688273029f6359d1b0000000000000000008a02000002f902860182d0dbb9010000000000000400008000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000200000000000000000000001000000000000000008000000000000000000008000000000000000000800000001020000000000000000000800000000000008000000000010000000000000000000800000000000000000800000000000000000000000000000000008000000000000000000000000000000000000000000000000800400000000000000000003000000000000000000000000000008000000000000000000000020000000000000000000000000000000000000100000000000000000000000000020f9017cf89b94a3f5a3af9fd0243c54a263c2acb4b400673ea7c6f863a0ddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3efa00000000000000000000000001ba30ee006f456615044415c5c84b2fd430525e2a00000000000000000000000000000000000000000000000000000000000000000a0000000000000000000000000000000000000000000000000000000000bebc200f8dd94242dfd130f39268f8b1b5dc760406a4cf90b1b73f884a04f89ece0f576ba3986204ba19a44d94601604b97cf3baa922b010a758d303842a0000000000000000000000000a3f5a3af9fd0243c54a263c2acb4b400673ea7c6a0000000000000000000000000717395aa760819a4ef9023bb4ca0c73f6c886c4fa00000000000000000000000001ba30ee006f456615044415c5c84b2fd430525e2b840000000000000000000000000000000000000000000000000000000000bebc2000000000000000000000000005710d43f700e8292ce83e688273029f6359d1b004c02000000f90248b86d00f86a4e0f8462bd045ba014c8e3a89c62b9cf69d66479bcc0a35452ebf33b83b3ee020cf7585965167c92a0f3317b97799e8ba0be6cb4ef34217949ea4c9aafa84d51eb42d066496eaebb4da00000000000000000000000000000000000000000000000000000000000000000a07d4100be49a9c62236193f41bfcbc0e3338295be7e84e038b732be7aa440be6ec0f901b4f84601f843a01bf2dfafca69535970e88d6394eb6277bb222dd633954b7f7a33f9a3ce217d6da070fc959c973320183385cda94638fdeb57061823bca66de0d34b7a506c643f7d80f84601f843a0c739ed6bb257820ec8ee127b3ded5b2ed2de37b20d98e780873c2ad31333f963a02ba8eb3846660d204b9cbb858e9e4ce9b5b46f7dbc3746d1bd8dad229ca53a2180c180f84601f843a076af34067a65b50954a8eda97c69c7ce4c3ba9294961f154a0e4c7e32c1d55a8a0245b69089d9c96637c0fcbd7fb8530bee74dbf539ed3062f3501cd9baa6a031801c180f84601f843a0f1b3d8be0e2c1eeef87f1908b5068a37d9fe3a26abc9c0542ce733e11b074992a069fab8baae3986b296b58bb9f875a3f0a4242a9cb5113f2d819ebb170aba0b3f01f84601f843a0c1d1c87720785177e8c5929994f5ba9c03a471b1e3aa3e433fe968cbbf012746a036fffc34e1c61681da50fe91fa3e87b7a33d340a5aedd5a14dea22217cc9f4b880f84601f843a02cd6ffd6b43a5c64e4eb34b6f475642a00642378e8be55beae296d0702b2b2a3a029161e5cfa18b5290dc96a32fd859155bdc8d2448a495bd6076f1a96db1d1054010100000093020000f90290822080b9028a02f902860182d0dbb9010000000000000400008000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000200000000000000000000001000000000000000008000000000000000000008000000000000000000800000001020000000000000000000800000000000008000000000010000000000000000000800000000000000000800000000000000000000000000000000008000000000000000000000000000000000000000000000000800400000000000000000003000000000000000000000000000008000000000000000000000020000000000000000000000000000000000000100000000000000000000000000020f9017cf89b94a3f5a3af9fd0243c54a263c2acb4b400673ea7c6f863a0ddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3efa00000000000000000000000001ba30ee006f456615044415c5c84b2fd430525e2a00000000000000000000000000000000000000000000000000000000000000000a0000000000000000000000000000000000000000000000000000000000bebc200f8dd94242dfd130f39268f8b1b5dc760406a4cf90b1b73f884a04f89ece0f576ba3986204ba19a44d94601604b97cf3baa922b010a758d303842a0000000000000000000000000a3f5a3af9fd0243c54a263c2acb4b400673ea7c6a0000000000000000000000000717395aa760819a4ef9023bb4ca0c73f6c886c4fa00000000000000000000000001ba30ee006f456615044415c5c84b2fd430525e2b840000000000000000000000000000000000000000000000000000000000bebc2000000000000000000000000005710d43f700e8292ce83e688273029f6359d1b00
    * 
    * 
    * 
    */

  describe('unlockToken', () => {
    it('invalid the function of topics', async () => {
      await erc20Locker.bindAssetHash(erc20Token.address, erc20Token2.address,erc20Token2.address);
      await erc20Token.approve(erc20Locker.address,toWei('200'))
      await erc20Locker.adminPause(0)
      await expect(erc20Locker.unlockTokenRuleOutSafeTransfer('0x0200000000000000df000000f8dd9454cfb970b8a0c6e51b3a00560ddd7ab07fa4bfccf884a056b161a6e4643e17140e8adce689a2b4dd38a651272b26645c7320a9284d7ab3a0000000000000000000000000765aa7a4032e48c1689c74aeb94fc78af1d1d89ca0000000000000000000000000a27692a39c507d9459e6ea165e0668a2a9853fd3a00000000000000000000000005710d43f700e8292ce83e688273029f6359d1b00b840000000000000000000000000000000000000000000000000000000003b9aca000000000000000000000000001c87fa50241404cafc5f52b34fad9a4f8fb2171e24000000000000002803000002f9032401834b393ab9010000000000008000200000000000040000000004000000000000000000000000400008000020000000000000000000000000000020000000000000000000200000200000000400000000000008000000000000000000000000000000000000000000000000004000400000000000000000040000000000000000000010000000000000000000000000000000080000000000000000000000000000000000000000020000000000000000400000000000000000000200000000000000005000000000000002000000000000000000000000000000000000000200000000000000000010000000000000000000000000000000000000080000000000000000000010f90219f89b94765aa7a4032e48c1689c74aeb94fc78af1d1d89cf863a08c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925a00000000000000000000000005710d43f700e8292ce83e688273029f6359d1b00a000000000000000000000000054cfb970b8a0c6e51b3a00560ddd7ab07fa4bfcca00000000000000000000000000000000000000000000000000163457592488800f89b94765aa7a4032e48c1689c74aeb94fc78af1d1d89cf863a0ddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3efa00000000000000000000000005710d43f700e8292ce83e688273029f6359d1b00a000000000000000000000000054cfb970b8a0c6e51b3a00560ddd7ab07fa4bfcca0000000000000000000000000000000000000000000000000000000003b9aca00f8dd9454cfb970b8a0c6e51b3a00560ddd7ab07fa4bfccf884a056b161a6e4643e17140e8adce689a2b4dd38a651272b26645c7320a9284d7ab3a0000000000000000000000000765aa7a4032e48c1689c74aeb94fc78af1d1d89ca0000000000000000000000000a27692a39c507d9459e6ea165e0668a2a9853fd3a00000000000000000000000005710d43f700e8292ce83e688273029f6359d1b00b840000000000000000000000000000000000000000000000000000000003b9aca000000000000000000000000001c87fa50241404cafc5f52b34fad9a4f8fb2171eff010000f901fca06001a068b9bb22bab00cb413dc9269ff153c2d923ab82f6bd4283177913ee972a01dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347943826539cbd8d68dcf119e80b994557b4278cec9fa08b2bbf15c35bf092184215358624ae70b300a9558d3c8eebfe1973f5184b45f6a0cf552caa104db87ae9a81d505a017eb2b90bdcf9918a06f2cdd4cf32eb5569daa0627bb20124282eeb2d531b8a3cfb38d6f71842bf6f17772582e238a706dbc1b0b9010004240000008020600000000080040000000004004000000000000000000000400008000020002000000000000000000008000020000400004021000000200000260000010401002008000008000000010000000400800502000000090000000020000008024004400800000000000c5004000100000000000000401001000004000000241200008080000009000010028000000000004080000000000020000042041800010002510040c10404000000000000020000120000000009500006000020000200000000000000000000110100000800020000020000010080002000001000000008000200000802004200000600a0004880000020000202240100108083be89528401c9c380835752a88462bbf24c80a05692c6e9f54a69e514615c4be7cc83a0a4ef0fe6e247dfa2e3f86e1676d2ccff8800000000000000000703000000b3000000f8b1a0ac023798184a3aab5354da33d9a1005b0caaf37e05d56f55c31c11ddb42ae45ba0d580ee6ff3d66750cb0c692ee2ea8e6dca6b8e7d63f7fae61245b7469facae1ba07bd3aa0fc76cd7dd550d94fc4830beda77b37a14058c3702f6577ad1ce7f2f14a0bd6f8614678d25c30a1be015857a7ec24f103812903998f3556f1aeaea46700980808080a0f207941f5df6330b5b37c32e40eff4548dddc99c98479e8bdb1468e5a18a107a808080808080808014020000f90211a0479512b68dd104275c47478c775c69d067142d049f20e9eef51778ab54d58749a0cdedd1a5f6815683a3e9daf4eb811f6975884d78a110785c80a660dae44d6104a0335d54fc7ac292467b0914e6822f0fac9ba584c44238c809a7f4acb8e6db7da3a0a4dc00cefcc27f53a8561bbf4808137feb5a3b6bcc92f893d6bd2ba340c7651aa0e05ef2c282facf5f955d76573f7ffe05e4331e69bcb2a3957bf1dd95fca658c0a08b669385ebfcb6007835c83fc04ea3cd21762931f4dcd96730fbb182e76cbe90a061574f9df3a0403eafb6748c681b9a991ec9be8530f3da92468bbdf685ae94f4a0f12ef25d70a2ca8d56d3dd8a6b5241a65ccea2667b3964f6d653e11aafec567ba0894e4a91ae5fa6ec8f8b9a83732030d211a2a1eecdbb131ee07e3d58bdaa3d4ca08de02e1a2ac36eb6fe8ff340b10ea6840eee35712485263b5376510a2cde063aa07f08b1db5b929ba4a21ed3b3039513412dba50486a306cf85d98cba56fdb651ea0145a5650f3f10c8094d8731c29502d02b57d89fe1ab89498cf7bc21139d33991a0e24b1e10e6acf4adea3f93dd6e5c1f6749d3724b96854be5a705f914aa93a40aa0143a9d7e55a4e89c24059c2567094e4c1cc9396d036c034bf8c2e6d437f7c8e6a052a1bd3b3d8a5387f00d81a1c0f74437fed942f719a27fa78f639e49a029cf7fa0daed0bdfe476baed85789c98d78023bfc0d49d7a1fb216ac8a7f36bb963d60ff802f030000f9032c20b9032802f9032401834b393ab9010000000000008000200000000000040000000004000000000000000000000000400008000020000000000000000000000000000020000000000000000000200000200000000400000000000008000000000000000000000000000000000000000000000000004000400000000000000000040000000000000000000010000000000000000000000000000000080000000000000000000000000000000000000000020000000000000000400000000000000000000200000000000000005000000000000002000000000000000000000000000000000000000200000000000000000010000000000000000000000000000000000000080000000000000000000010f90219f89b94765aa7a4032e48c1689c74aeb94fc78af1d1d89cf863a08c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925a00000000000000000000000005710d43f700e8292ce83e688273029f6359d1b00a000000000000000000000000054cfb970b8a0c6e51b3a00560ddd7ab07fa4bfcca00000000000000000000000000000000000000000000000000163457592488800f89b94765aa7a4032e48c1689c74aeb94fc78af1d1d89cf863a0ddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3efa00000000000000000000000005710d43f700e8292ce83e688273029f6359d1b00a000000000000000000000000054cfb970b8a0c6e51b3a00560ddd7ab07fa4bfcca0000000000000000000000000000000000000000000000000000000003b9aca00f8dd9454cfb970b8a0c6e51b3a00560ddd7ab07fa4bfccf884a056b161a6e4643e17140e8adce689a2b4dd38a651272b26645c7320a9284d7ab3a0000000000000000000000000765aa7a4032e48c1689c74aeb94fc78af1d1d89ca0000000000000000000000000a27692a39c507d9459e6ea165e0668a2a9853fd3a00000000000000000000000005710d43f700e8292ce83e688273029f6359d1b00b840000000000000000000000000000000000000000000000000000000003b9aca000000000000000000000000001c87fa50241404cafc5f52b34fad9a4f8fb2171e',0)).to.be.revertedWith('invalid the function of topics')
    })

    it('proxy is not bound', async () => {
      await erc20Locker.bindAssetHash(erc20Token.address, erc20Token2.address,erc20Token2.address);
      await erc20Token.approve(erc20Locker.address,toWei('200'))
      await erc20Locker.adminPause(0)
      await expect(erc20Locker.unlockTokenRuleOutSafeTransfer('0x0100000000000000df000000f8dd94242dfd130f39268f8b1b5dc760406a4cf90b1b73f884a04f89ece0f576ba3986204ba19a44d94601604b97cf3baa922b010a758d303842a0000000000000000000000000a3f5a3af9fd0243c54a263c2acb4b400673ea7c6a0000000000000000000000000717395aa760819a4ef9023bb4ca0c73f6c886c4fa00000000000000000000000001ba30ee006f456615044415c5c84b2fd430525e2b840000000000000000000000000000000000000000000000000000000000bebc2000000000000000000000000005710d43f700e8292ce83e688273029f6359d1b0000000000000000008a02000002f902860182d0dbb9010000000000000400008000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000200000000000000000000001000000000000000008000000000000000000008000000000000000000800000001020000000000000000000800000000000008000000000010000000000000000000800000000000000000800000000000000000000000000000000008000000000000000000000000000000000000000000000000800400000000000000000003000000000000000000000000000008000000000000000000000020000000000000000000000000000000000000100000000000000000000000000020f9017cf89b94a3f5a3af9fd0243c54a263c2acb4b400673ea7c6f863a0ddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3efa00000000000000000000000001ba30ee006f456615044415c5c84b2fd430525e2a00000000000000000000000000000000000000000000000000000000000000000a0000000000000000000000000000000000000000000000000000000000bebc200f8dd94242dfd130f39268f8b1b5dc760406a4cf90b1b73f884a04f89ece0f576ba3986204ba19a44d94601604b97cf3baa922b010a758d303842a0000000000000000000000000a3f5a3af9fd0243c54a263c2acb4b400673ea7c6a0000000000000000000000000717395aa760819a4ef9023bb4ca0c73f6c886c4fa00000000000000000000000001ba30ee006f456615044415c5c84b2fd430525e2b840000000000000000000000000000000000000000000000000000000000bebc2000000000000000000000000005710d43f700e8292ce83e688273029f6359d1b004c02000000f90248b86d00f86a4e0f8462bd045ba014c8e3a89c62b9cf69d66479bcc0a35452ebf33b83b3ee020cf7585965167c92a0f3317b97799e8ba0be6cb4ef34217949ea4c9aafa84d51eb42d066496eaebb4da00000000000000000000000000000000000000000000000000000000000000000a07d4100be49a9c62236193f41bfcbc0e3338295be7e84e038b732be7aa440be6ec0f901b4f84601f843a01bf2dfafca69535970e88d6394eb6277bb222dd633954b7f7a33f9a3ce217d6da070fc959c973320183385cda94638fdeb57061823bca66de0d34b7a506c643f7d80f84601f843a0c739ed6bb257820ec8ee127b3ded5b2ed2de37b20d98e780873c2ad31333f963a02ba8eb3846660d204b9cbb858e9e4ce9b5b46f7dbc3746d1bd8dad229ca53a2180c180f84601f843a076af34067a65b50954a8eda97c69c7ce4c3ba9294961f154a0e4c7e32c1d55a8a0245b69089d9c96637c0fcbd7fb8530bee74dbf539ed3062f3501cd9baa6a031801c180f84601f843a0f1b3d8be0e2c1eeef87f1908b5068a37d9fe3a26abc9c0542ce733e11b074992a069fab8baae3986b296b58bb9f875a3f0a4242a9cb5113f2d819ebb170aba0b3f01f84601f843a0c1d1c87720785177e8c5929994f5ba9c03a471b1e3aa3e433fe968cbbf012746a036fffc34e1c61681da50fe91fa3e87b7a33d340a5aedd5a14dea22217cc9f4b880f84601f843a02cd6ffd6b43a5c64e4eb34b6f475642a00642378e8be55beae296d0702b2b2a3a029161e5cfa18b5290dc96a32fd859155bdc8d2448a495bd6076f1a96db1d1054010100000093020000f90290822080b9028a02f902860182d0dbb9010000000000000400008000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000200000000000000000000001000000000000000008000000000000000000008000000000000000000800000001020000000000000000000800000000000008000000000010000000000000000000800000000000000000800000000000000000000000000000000008000000000000000000000000000000000000000000000000800400000000000000000003000000000000000000000000000008000000000000000000000020000000000000000000000000000000000000100000000000000000000000000020f9017cf89b94a3f5a3af9fd0243c54a263c2acb4b400673ea7c6f863a0ddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3efa00000000000000000000000001ba30ee006f456615044415c5c84b2fd430525e2a00000000000000000000000000000000000000000000000000000000000000000a0000000000000000000000000000000000000000000000000000000000bebc200f8dd94242dfd130f39268f8b1b5dc760406a4cf90b1b73f884a04f89ece0f576ba3986204ba19a44d94601604b97cf3baa922b010a758d303842a0000000000000000000000000a3f5a3af9fd0243c54a263c2acb4b400673ea7c6a0000000000000000000000000717395aa760819a4ef9023bb4ca0c73f6c886c4fa00000000000000000000000001ba30ee006f456615044415c5c84b2fd430525e2b840000000000000000000000000000000000000000000000000000000000bebc2000000000000000000000000005710d43f700e8292ce83e688273029f6359d1b00',0)).to.be.revertedWith('proxy is not bound')
    })

    it('unlockToken success', async () => {
      await erc20Locker.bindAssetHash('0x717395aA760819A4EF9023bB4ca0c73f6C886c4f','0xA3F5a3af9Fd0243c54a263C2ACB4B400673Ea7c6','0x242dFD130f39268F8b1b5Dc760406a4Cf90b1b73');
      await erc20Token.approve(erc20Locker.address,toWei('200'))
      await erc20Locker.adminPause(0)
      //blockHashes(bytes32)
      await bridge.mock.blockHashes.withArgs('0x92c0704053270ca94e72cda58431cd2bc0415a33eff6b377fc30a3ed0e1dc78d').returns(true)
      await bridge.mock.blockHeights.withArgs(78).returns(11)
      await erc20Locker.unlockTokenRuleOutSafeTransfer('0x0100000000000000df000000f8dd94242dfd130f39268f8b1b5dc760406a4cf90b1b73f884a04f89ece0f576ba3986204ba19a44d94601604b97cf3baa922b010a758d303842a0000000000000000000000000a3f5a3af9fd0243c54a263c2acb4b400673ea7c6a0000000000000000000000000717395aa760819a4ef9023bb4ca0c73f6c886c4fa00000000000000000000000001ba30ee006f456615044415c5c84b2fd430525e2b840000000000000000000000000000000000000000000000000000000000bebc2000000000000000000000000005710d43f700e8292ce83e688273029f6359d1b0000000000000000008a02000002f902860182d0dbb9010000000000000400008000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000200000000000000000000001000000000000000008000000000000000000008000000000000000000800000001020000000000000000000800000000000008000000000010000000000000000000800000000000000000800000000000000000000000000000000008000000000000000000000000000000000000000000000000800400000000000000000003000000000000000000000000000008000000000000000000000020000000000000000000000000000000000000100000000000000000000000000020f9017cf89b94a3f5a3af9fd0243c54a263c2acb4b400673ea7c6f863a0ddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3efa00000000000000000000000001ba30ee006f456615044415c5c84b2fd430525e2a00000000000000000000000000000000000000000000000000000000000000000a0000000000000000000000000000000000000000000000000000000000bebc200f8dd94242dfd130f39268f8b1b5dc760406a4cf90b1b73f884a04f89ece0f576ba3986204ba19a44d94601604b97cf3baa922b010a758d303842a0000000000000000000000000a3f5a3af9fd0243c54a263c2acb4b400673ea7c6a0000000000000000000000000717395aa760819a4ef9023bb4ca0c73f6c886c4fa00000000000000000000000001ba30ee006f456615044415c5c84b2fd430525e2b840000000000000000000000000000000000000000000000000000000000bebc2000000000000000000000000005710d43f700e8292ce83e688273029f6359d1b004c02000000f90248b86d00f86a4e0f8462bd045ba014c8e3a89c62b9cf69d66479bcc0a35452ebf33b83b3ee020cf7585965167c92a0f3317b97799e8ba0be6cb4ef34217949ea4c9aafa84d51eb42d066496eaebb4da00000000000000000000000000000000000000000000000000000000000000000a07d4100be49a9c62236193f41bfcbc0e3338295be7e84e038b732be7aa440be6ec0f901b4f84601f843a01bf2dfafca69535970e88d6394eb6277bb222dd633954b7f7a33f9a3ce217d6da070fc959c973320183385cda94638fdeb57061823bca66de0d34b7a506c643f7d80f84601f843a0c739ed6bb257820ec8ee127b3ded5b2ed2de37b20d98e780873c2ad31333f963a02ba8eb3846660d204b9cbb858e9e4ce9b5b46f7dbc3746d1bd8dad229ca53a2180c180f84601f843a076af34067a65b50954a8eda97c69c7ce4c3ba9294961f154a0e4c7e32c1d55a8a0245b69089d9c96637c0fcbd7fb8530bee74dbf539ed3062f3501cd9baa6a031801c180f84601f843a0f1b3d8be0e2c1eeef87f1908b5068a37d9fe3a26abc9c0542ce733e11b074992a069fab8baae3986b296b58bb9f875a3f0a4242a9cb5113f2d819ebb170aba0b3f01f84601f843a0c1d1c87720785177e8c5929994f5ba9c03a471b1e3aa3e433fe968cbbf012746a036fffc34e1c61681da50fe91fa3e87b7a33d340a5aedd5a14dea22217cc9f4b880f84601f843a02cd6ffd6b43a5c64e4eb34b6f475642a00642378e8be55beae296d0702b2b2a3a029161e5cfa18b5290dc96a32fd859155bdc8d2448a495bd6076f1a96db1d1054010100000093020000f90290822080b9028a02f902860182d0dbb9010000000000000400008000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000200000000000000000000001000000000000000008000000000000000000008000000000000000000800000001020000000000000000000800000000000008000000000010000000000000000000800000000000000000800000000000000000000000000000000008000000000000000000000000000000000000000000000000800400000000000000000003000000000000000000000000000008000000000000000000000020000000000000000000000000000000000000100000000000000000000000000020f9017cf89b94a3f5a3af9fd0243c54a263c2acb4b400673ea7c6f863a0ddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3efa00000000000000000000000001ba30ee006f456615044415c5c84b2fd430525e2a00000000000000000000000000000000000000000000000000000000000000000a0000000000000000000000000000000000000000000000000000000000bebc200f8dd94242dfd130f39268f8b1b5dc760406a4cf90b1b73f884a04f89ece0f576ba3986204ba19a44d94601604b97cf3baa922b010a758d303842a0000000000000000000000000a3f5a3af9fd0243c54a263c2acb4b400673ea7c6a0000000000000000000000000717395aa760819a4ef9023bb4ca0c73f6c886c4fa00000000000000000000000001ba30ee006f456615044415c5c84b2fd430525e2b840000000000000000000000000000000000000000000000000000000000bebc2000000000000000000000000005710d43f700e8292ce83e688273029f6359d1b00',0)
    })

  })
  
})

  
