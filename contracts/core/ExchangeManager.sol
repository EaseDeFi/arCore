// SPDX-License-Identifier: (c) Armor.Fi DAO, 2021

pragma solidity ^0.6.12;

import '../general/ArmorModule.sol';
import '../interfaces/IERC20.sol';
import '../interfaces/IARNXMVault.sol';
import '../interfaces/IClaimManager.sol';
import '../interfaces/INexusMutual.sol';
import '../interfaces/IBalancer.sol';
import '../interfaces/IUniswap.sol';

/**
 * ExchangeManager contract enables us to slowly exchange excess claim funds for wNXM then transfer to the arNXM vault. 
**/
contract ExchangeManager is ArmorModule {
    
    IARNXMVault public immutable ARNXM_VAULT; // = 0x1337DEF1FC06783D4b03CB8C1Bf3EBf7D0593FC4;
    IERC20 public immutable WETH; //=0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2
    IERC20 public immutable WNXM; //= IERC20(0x0d438F3b5175Bebc262bF23753C1E53d03432bDE);
    INXMMaster public immutable NXM_MASTER;
    IBFactory public immutable BALANCER_FACTORY;
    IUniswapV2Router02 public immutable UNI_ROUTER;
    IUniswapV2Router02 public immutable SUSHI_ROUTER;
   
    constructor(address _arnxmvault,address _weth, address _wnxm, address _nxm_master, address _bfactory, address _uni, address _sushi) public {
        ARNXM_VAULT = IARNXMVault(_arnxmvault);
        WETH = IERC20(_weth);
        WNXM = IERC20(_wnxm);
        NXM_MASTER = INXMMaster(_nxm_master);
        BALANCER_FACTORY = IBFactory(_bfactory);
        UNI_ROUTER = IUniswapV2Router02(_uni);
        SUSHI_ROUTER = IUniswapV2Router02(_sushi);
    }

    // ClaimManager will be sending Ether to this contract.
    receive() external payable { }
    
    /**
     * @dev Initialize master for the contract. Owner must also add module for ExchangeManager to master upon deployment.
     * @param _armorMaster Address of the ArmorMaster contract.
    **/
    function initialize(address _armorMaster)
      external
    {
        initializeModule(_armorMaster);
    }
    
    /**
     * @dev Main function to withdraw Ether from ClaimManager, exchange, then transfer to arNXM Vault.
     * @param _amount Amount of Ether (in Wei) to withdraw from ClaimManager.
     * @param _minReturn Minimum amount of wNXM we will accept in return for the Ether exchanged.
    **/
    function buyWNxmUni(uint256 _amount, uint256 _minReturn, address[] memory _path)
      external
      onlyOwner
    {
        _requestFunds(_amount);
        _exchangeAndSendToVault(address(UNI_ROUTER), _minReturn, _path);
    }
    
    /**
     * @dev Main function to withdraw Ether from ClaimManager, exchange, then transfer to arNXM Vault.
     * @param _amount Amount of Ether (in Wei) to withdraw from ClaimManager.
     * @param _minReturn Minimum amount of wNXM we will accept in return for the Ether exchanged.
    **/
    function buyWNxmSushi(uint256 _amount, uint256 _minReturn, address[] memory _path)
      external
      onlyOwner
    {
        _requestFunds(_amount);
        _exchangeAndSendToVault(address(SUSHI_ROUTER), _minReturn, _path);
    }

    function buyWNXMBalancer(uint256 _amount, address _bpool, uint256 _minReturn, uint256 _maxPrice)
      external
      onlyOwner
    {
        require(BALANCER_FACTORY.isBPool(_bpool), "NOT_BPOOL");
        _requestFunds(_amount);
        uint256 balance = address(this).balance;
        IBPool(_bpool).swapExactAmountIn(address(WETH), balance, address(WNXM), _minReturn, _maxPrice);
        _transferWNXM();
        ARNXM_VAULT.unwrapWnxm();
    }
    
    /**
     * @dev Main function to withdraw Ether from ClaimManager, exchange, then transfer to arNXM Vault.
     * @param _ethAmount Amount of Ether (in Wei) to withdraw from ClaimManager.
     * @param _minNxm Minimum amount of NXM we will accept in return for the Ether exchanged.
    **/
    function buyNxm(uint256 _ethAmount, uint256 _minNxm)
      external
      onlyOwner
    {
        _requestFunds(_ethAmount);
        INXMPool pool = INXMPool(NXM_MASTER.getLatestAddress("P1"));
        pool.buyNXM{value:_ethAmount}(_minNxm);
        _transferNXM();
    }

    /**
     * @dev Call ClaimManager to request Ether from the contract.
     * @param _amount Ether (in Wei) to withdraw from ClaimManager.
    **/
    function _requestFunds(uint256 _amount)
      internal
    {
        IClaimManager( getModule("CLAIM") ).exchangeWithdrawal(_amount);
    }
 
    /**
     * @dev Exchange all Ether for wNXM on uniswap-like exchanges
     * @param _router router address of uniswap-like protocols(uni/sushi)
     * @param _minReturn Minimum amount of wNXM we wish to receive from the exchange.
    **/
    function _exchangeAndSendToVault(address _router, uint256 _minReturn, address[] memory _path)
      internal
    {
        uint256 ethBalance = address(this).balance;
        IUniswapV2Router02(_router).swapExactETHForTokens{value:ethBalance}(_minReturn, _path, address(ARNXM_VAULT), uint256(~0) );
        ARNXM_VAULT.unwrapWnxm();
    }
    
    /**
     * @dev Transfer all wNXM directly to arNXM. This will not mint more arNXM so it will add value to arNXM.
    **/
    function _transferWNXM()
      internal
    {
        uint256 wNxmBalance = WNXM.balanceOf( address(this) );
        WNXM.transfer(address(ARNXM_VAULT), wNxmBalance);
    }

    /**
     * @dev Transfer all NXM directly to arNXM. This will not mint more arNXM so it will add value to arNXM.
    **/
    function _transferNXM()
      internal
    {
        IERC20 NXM = IERC20(NXM_MASTER.tokenAddress());
        uint256 nxmBalance = NXM.balanceOf( address(this) );
        NXM.transfer(address(ARNXM_VAULT), nxmBalance);
    }
}
