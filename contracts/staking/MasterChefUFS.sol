// SPDX-License-Identifier: (c) Armor.Fi DAO, 2021

pragma solidity ^0.6.6;

import "./UtilizationFarm.sol";
import "../interfaces/IArmorMaster.sol";
import "../interfaces/IStakeManager.sol";
import "../interfaces/IPlanManager.sol";
/**
 * @dev UtilizationFarm is nearly the exact same contract as RewardManager.
 *      Only difference is the initialize function instead of constructor.
**/

/**
* MIT License
* ===========
*
* Copyright (c) 2020 Synthetix
*
* Permission is hereby granted, free of charge, to any person obtaining a copy
* of this software and associated documentation files (the "Software"), to deal
* in the Software without restriction, including without limitation the rights
* to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
* copies of the Software, and to permit persons to whom the Software is
* furnished to do so, subject to the following conditions:
*
* The above copyright notice and this permission notice shall be included in all
* copies or substantial portions of the Software.
*
* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
* IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
* FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
* AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
* LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
* OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
*/

contract MasterChefUtilizationFarm is UtilizationFarm {
    using SafeERC20 for IERC20;
    struct UserInfo {
        uint256 amount; // How many LP tokens the user has provided.
        uint256 rewardDebt; // Reward debt. See explanation below.
        //
        // We do some fancy math here. Basically, any point in time, the amount of SUSHIs
        // entitled to a user but is pending to be distributed is:
        //
        //   pending reward = (user.amount * pool.accArmorPerShare) - user.rewardDebt
        //
        // Whenever a user deposits or withdraws LP tokens to a pool. Here's what happens:
        //   1. The pool's `accArmorPerShare` (and `lastRewardBlock`) gets updated.
        //   2. User receives the pending reward sent to his/her address.
        //   3. User's `amount` gets updated.
        //   4. User's `rewardDebt` gets updated.
    }
    struct PoolInfo {
        address protocol; // Address of protocol contract.
        uint256 lastRewardBlock; // Last block number that SUSHIs distribution occurs.
        uint256 accArmorPerShare; // Accumulated SUSHIs per share, times 1e12. See below.
    }

    uint256 public armorPerBlock;

    mapping(address => PoolInfo) public poolInfo;

    mapping(address => mapping(address => UserInfo)) public userInfo;

    mapping(uint256 => bool) public submitted;

    function initializeMasterChef(uint256 _armorPerBlock) external {
        require(armorPerBlock == 0, "already initialized");
        armorPerBlock = _armorPerBlock;
    }
    
    function deposit(address _user, address _protocol, uint256 _nftId, uint256 _amount) public onlyModules("BALANCE", "STAKE"){
        submitted[_nftId] = true;
        PoolInfo storage pool = poolInfo[_protocol];
        UserInfo storage user = userInfo[_protocol][_user];
        updatePool(_protocol);
        if (user.amount > 0) {
            uint256 pending =
                user.amount.mul(pool.accArmorPerShare).div(1e12).sub(
                    user.rewardDebt
                );
            safeArmorTransfer(_user, pending);
        }
        user.amount = user.amount.add(_amount);
        user.rewardDebt = user.amount.mul(pool.accArmorPerShare).div(1e12);
    }
    
    function withdraw(address _user, address _protocol, uint256 _nftId, uint256 _amount) public onlyModules("BALANCE", "STAKE"){
        if(!submitted[_nftId]){
            // to onboard original users
            withdraw(_user, _amount);
            return;
        }
        PoolInfo storage pool = poolInfo[_protocol];
        UserInfo storage user = userInfo[_protocol][_user];
        require(user.amount >= _amount, "withdraw: not good");
        updatePool(_protocol);
        uint256 pending =
            user.amount.mul(pool.accArmorPerShare).div(1e12).sub(
                user.rewardDebt
            );
        safeArmorTransfer(_user, pending);
        user.amount = user.amount.sub(_amount);
        user.rewardDebt = user.amount.mul(pool.accArmorPerShare).div(1e12);
        submitted[_nftId] = false;
    }

    function getMultiplier(address _protocol, uint256 _from, uint256 _to) public view returns(uint256){
        IStakeManager stakeManager = IStakeManager(_master.getModule("STAKE"));
        IPlanManager planManager = IPlanManager(_master.getModule("PLAN"));
        uint256 staked = stakeManager.totalStakedAmount(_protocol);
        uint256 used = planManager.totalUsedCover(_protocol);
        // no denominator here since i don't wanna mess up the contract
        return _to.sub(_from).mul((staked.add(used)).div(staked));
    }
    
    function updatePool(address _protocol) public {
        PoolInfo storage pool = poolInfo[_protocol];
        if (block.number <= pool.lastRewardBlock) {
            return;
        }
        IStakeManager stakeManager = IStakeManager(_master.getModule("STAKE"));
        uint256 totalStaked = stakeManager.totalStakedAmount(_protocol);
        if (totalStaked == 0) {
            pool.lastRewardBlock = block.number;
            return;
        }
        uint256 multiplier = getMultiplier(_protocol, pool.lastRewardBlock, block.number);
        uint256 armorReward =
            multiplier.mul(armorPerBlock).div(
                uint256(stakeManager.protocolCount())
            );
        pool.accArmorPerShare = pool.accArmorPerShare.add(
            armorReward.mul(1e12).div(totalStaked)
        );
        pool.lastRewardBlock = block.number;
    }
    
    function safeArmorTransfer(address _to, uint256 _amount) internal {
        uint256 armorBal = rewardToken.balanceOf(address(this));
        if (_amount > armorBal) {
            rewardToken.transfer(_to, armorBal);
        } else {
            rewardToken.transfer(_to, _amount);
        }
    }
}
