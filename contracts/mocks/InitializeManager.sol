// SPDX-License-Identifier: MIT

pragma solidity ^0.6.6;
import '../interfaces/IBalanceManager.sol';
import '../interfaces/IClaimManager.sol';
import '../interfaces/IPlanManager.sol';
import '../interfaces/IRewardManager.sol';
import '../interfaces/IStakeManager.sol';

contract InitializeManager {
    
    constructor(address _arNFT,
                address _armorToken,
                address _balanceManager,
                address _claimManager,
                address _planManager,
                address _rewardManager,
                address _stakeManager)
      public
    {
        IBalanceManager(_balanceManager).initialize(_planManager);
        IClaimManager(_claimManager).initialize(_planManager, _stakeManager, _arNFT);
        IPlanManager(_planManager).initialize(_stakeManager, _balanceManager, _claimManager);
        IRewardManager(_rewardManager).initialize(_armorToken, _stakeManager, msg.sender);
        IStakeManager(_stakeManager).initialize(_arNFT, _rewardManager, _planManager, _claimManager);
    }
    
}
