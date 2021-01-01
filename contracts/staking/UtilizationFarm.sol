// SPDX-License-Identifier: MIT

pragma solidity ^0.6.6;

import '../general/Ownable.sol';
import '../general/SafeERC20.sol';
import '../general/BalanceWrapper.sol';
import '../general/ExpireTracker.sol';
import '../libraries/Math.sol';
import '../libraries/SafeMath.sol';
import '../interfaces/IERC20.sol';
import '../interfaces/IRewardDistributionRecipientTokenOnly.sol';

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

contract UtilizationFarm is BalanceWrapper, Ownable, ExpireTracker, IRewardDistributionRecipientTokenOnly {
    using SafeERC20 for IERC20;

    IERC20 public rewardToken;
    address public stakeController;
    address public rewardDistribution;
    uint256 public constant DURATION = 7 days;

    uint256 public periodFinish = 0;
    uint256 public rewardRate = 0;
    uint256 public lastUpdateTime;
    uint256 public rewardPerTokenStored;
    mapping(address => uint256) public userRewardPerTokenPaid;
    mapping(address => uint256) public rewards;

    //decay functionality
    mapping(uint96 => DecayTracker) public decayInfo;
    mapping(address => uint96) internal decayInfoOf;
    uint96 public decayInfoCount;
    // TODO: need to add keep() to make totalDecayRatio to be up to date
    uint256 public totalDecayRatio;


    struct DecayTracker {
        address staker;
        uint64 expiresAt;
        uint256 decayRatio;
    }

    event RewardAdded(uint256 reward);
    event BalanceAdded(address indexed user, uint256 amount);
    event BalanceWithdrawn(address indexed user, uint256 amount);
    event RewardPaid(address indexed user, uint256 reward);

    modifier updateReward(address account) {
        rewardPerTokenStored = rewardPerToken();
        _totalSupply = totalSupply();
        lastUpdateTime = lastTimeRewardApplicable();
        if (account != address(0)) {
            rewards[account] = earned(account);
            userRewardPerTokenPaid[account] = rewardPerTokenStored;
        }
        _;
    }

    modifier onlyRewardDistribution() {
        require(msg.sender == rewardDistribution, "Caller is not reward distribution");
        _;
    }

    function totalSupply() public view returns(uint256) {
        uint256 timediff = lastTimeRewardApplicable().sub(lastUpdateTime);
        return _totalSupply.sub(timediff.mul(totalDecayRatio));
    }

    function balanceOf(address user) public view returns(uint256) {
    }

    function initialize(address _rewardToken, address _stakeController)
      public
    {
        require(_rewardToken == address(0), "Contract is already initialized.");
        stakeController = _stakeController;
        rewardToken = IERC20(_rewardToken);
    }

    function setRewardDistribution(address _rewardDistribution)
        external
        override
        onlyOwner
    {
        rewardDistribution = _rewardDistribution;
    }

    function lastTimeRewardApplicable() public view returns (uint256) {
        return Math.min(block.timestamp, periodFinish);
    }

    function rewardPerToken() public view returns (uint256) {
        //TODO: update this
        if (totalSupply() == 0) {
            return rewardPerTokenStored;
        }
        uint256 timediff = lastTimeRewardApplicable().sub(lastUpdateTime);
        return
            rewardPerTokenStored.add(
                timediff
                    .mul(rewardRate)
                    .mul(1e18)
                    .div(
                        totalSupply()
                        .add(
                            timediff.mul(totalDecayRatio).div(2)
                        )
                    )
            );
    }

    function keep() external {
        // TODO: check if any decay ratio is going to be expired
    }

    function _updateDecayRatio(address user, uint256 decayRatio) internal {
        if(decayInfoOf[user] != 0){
            //POP
            uint96 decayId = decayInfoOf[user];
            uint256 oldDecayRatio = decayInfo[decayId].decayRatio;
            uint64 oldExpiresAt = decayInfo[decayId].expiresAt;
            ExpireTracker.pop(expireId, oldExpiresAt);
            //push again
            uint256 expiresAt = balanceOf(user).div(decayRatio);
            decayInfoOf[user] = 
            ExpireTracker.push(decayId, expiresAt);
        } else {
            //push
            uint256 decayId = ++decayInfoCount;
            uint256 expiresAt = balanceOf(user).div(decayRatio);
            ExpireTracker.push(decayId, expiresAt);
            decayInfoOf[user] = DecayInfo(user, expiresAt);
        }
        emit DecayRatioUpdated(user, decayRatio, expiresAt);
    }

    function _expireDecayInfo(uint96 decayId) internal {
    }

    function earned(address account) public view returns (uint256) {
        return
            balanceOf(account)
                .mul(rewardPerToken().sub(userRewardPerTokenPaid[account]))
                .div(1e18)
                .add(rewards[account]);
    }

    // stake visibility is public as overriding LPTokenWrapper's stake() function
    function stake(address user, uint256 amount, uint256 decayRatio) public updateReward(user) {
        require(msg.sender == stakeController, "Caller is not the stake controller.");
        _addStake(user, amount);
        _updateDecayRatio(user, decayRatio);
        emit BalanceAdded(user, amount);
    }

    function withdraw(address user, uint256 amount) public updateReward(user) {
        require(msg.sender == stakeController, "Caller is not the stake controller.");
        _removeStake(user, amount);
        uint96 decayId = decayInfoOf[user];
        uint256 decayRatio = decayInfo[decayId].decayRatio;
        _updateDecayRatio(user, decayRatio);
        emit BalanceWithdrawn(user, amount);
    }


    function exit() external {
        withdraw(msg.sender, balanceOf(msg.sender));
        getReward();
    }

    function getReward() public updateReward(msg.sender) {
        uint256 reward = earned(msg.sender);
        if (reward > 0) {
            rewards[msg.sender] = 0;
            rewardToken.safeTransfer(msg.sender, reward);
            emit RewardPaid(msg.sender, reward);
        }
    }

    function notifyRewardAmount(uint256 reward)
        external
        override
        onlyRewardDistribution
        updateReward(address(0))
    {
        rewardToken.safeTransferFrom(msg.sender, address(this), reward);
        if (block.timestamp >= periodFinish) {
            rewardRate = reward.div(DURATION);
        } else {
            uint256 remaining = periodFinish.sub(block.timestamp);
            uint256 leftover = remaining.mul(rewardRate);
            rewardRate = reward.add(leftover).div(DURATION);
        }
        lastUpdateTime = block.timestamp;
        periodFinish = block.timestamp.add(DURATION);
        emit RewardAdded(reward);
    }
}
