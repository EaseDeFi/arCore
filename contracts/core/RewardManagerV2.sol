// SPDX-License-Identifier: (c) Armor.Fi DAO, 2021

pragma solidity ^0.6.6;

import "../general/ArmorModule.sol";
import "../general/BalanceWrapper.sol";
import "../libraries/Math.sol";
import "../libraries/SafeMath.sol";
import "../interfaces/IPlanManager.sol";
import "../interfaces/IRewardManagerV2.sol";

/**
 * @dev RewardManagerV2 is a updated RewardManager to distribute rewards.
 *      based on total used cover per protocols.
 **/

contract RewardManagerV2 is BalanceWrapper, ArmorModule, IRewardManagerV2 {
    /**
     * @dev Universal requirements:
     *      - Calculate reward per protocol by totalUsedCover.
     *      - onlyGov functions must only ever be able to be accessed by governance.
     *      - Total of refBals must always equal refTotal.
     *      - depositor should always be address(0) if contract is not locked.
     *      - totalTokens must always equal pToken.balanceOf( address(this) ) - (refTotal + sum(feesToLiq) ).
    **/

    event RewardPaid(address indexed user, address indexed protocol, uint256 reward, uint256 timestamp);
    event BalanceAdded(
        address indexed user,
        address indexed protocol,
        uint256 indexed nftId,
        uint256 amount,
        uint256 totalStaked,
        uint256 timestamp
    );
    event BalanceWithdrawn(
        address indexed user,
        address indexed protocol,
        uint256 indexed nftId,
        uint256 amount,
        uint256 totalStaked,
        uint256 timestamp
    );

    struct UserInfo {
        uint256 amount; // How much cover staked
        uint256 rewardDebt; // Reward debt.
    }
    struct PoolInfo {
        address protocol; // Address of protocol contract.
        uint256 totalStaked; // Total staked amount in the pool
        uint256 allocPoint; // Allocation of protocol - same as totalUsedCover.
        uint256 accEthPerShare; // Accumulated ETHs per share, times 1e12.
        uint256 rewardDebt; // Pool Reward debt.
    }

    // Total alloc point - sum of totalUsedCover for initialized pools
    uint256 public totalAllocPoint;
    // Accumlated ETHs per alloc, times 1e12.
    uint256 public accEthPerAlloc;
    // Last reward updated block
    uint256 public lastRewardBlock;
    // Reward per block - updates when reward notified
    uint256 public rewardPerBlock;
    // Time when all reward will be distributed - updates when reward notified
    uint256 public rewardCycleEnd;
    // Currently used reward in cycle - used to calculate remaining reward at the reward notification
    uint256 public usedReward;

    // reward cycle period
    uint256 public rewardCycle;
    // last reward amount
    uint256 public lastReward;

    // Reward info for each protocol
    mapping(address => PoolInfo) public poolInfo;

    // Reward info for user in each protocol
    mapping(address => mapping(address => UserInfo)) public userInfo;

    /**
     * @notice Controller immediately initializes contract with this.
     * @dev - Must set all included variables properly.
     *      - Update last reward block as initialized block.
     * @param _armorMaster Address of ArmorMaster.
     * @param _rewardCycleBlocks Block amounts in one cycle.
    **/
    function initialize(address _armorMaster, uint256 _rewardCycleBlocks)
        external
        override
    {
        initializeModule(_armorMaster);
        require(_rewardCycleBlocks > 0, "Invalid cycle blocks");
        rewardCycle = _rewardCycleBlocks;
        lastRewardBlock = block.number;
    }

    /**
     * @notice Only BalanceManager can call this function to notify reward.
     * @dev - Reward must be greater than 0.
     *      - Must update reward info before notify.
     *      - Must contain remaining reward of previous cycle
     *      - Update reward cycle info
    **/
    function notifyRewardAmount()
        external
        payable
        override
        onlyModule("BALANCE")
    {
        require(msg.value > 0, "Invalid reward");
        updateReward();
        uint256 remainingReward = lastReward > usedReward
            ? lastReward.sub(usedReward)
            : 0;
        lastReward = msg.value.add(remainingReward);
        usedReward = 0;
        rewardCycleEnd = block.number.add(rewardCycle);
        rewardPerBlock = lastReward.div(rewardCycle);
    }

    /**
     * @notice Update RewardManagerV2 reward information.
     * @dev - Skip if already updated.
     *      - Skip if totalAllocPoint is zero or reward not notified yet.
    **/
    function updateReward() public {
        if (block.number <= lastRewardBlock) {
            return;
        }

        if (rewardCycleEnd == 0 || totalAllocPoint == 0) {
            lastRewardBlock = block.number;
            return;
        }

        uint256 reward = Math
            .min(rewardCycleEnd, block.number)
            .sub(lastRewardBlock)
            .mul(rewardPerBlock);
        usedReward = usedReward.add(reward);
        accEthPerAlloc = accEthPerAlloc.add(
            reward.mul(1e12).div(totalAllocPoint)
        );
        lastRewardBlock = block.number;
    }

    /**
     * @notice Only Plan and Stake manager can call this function.
     * @dev - Must update reward info before initialize pool.
     *      - Cannot initlize again.
     *      - Must update pool rewardDebt and totalAllocPoint.
     * @param _protocol Protocol address.
    **/
    function initPool(address _protocol)
        public
        override
        onlyModules("PLAN", "STAKE")
    {
        require(_protocol != address(0), "zero address!");
        PoolInfo storage pool = poolInfo[_protocol];
        require(pool.protocol == address(0), "already initialized");
        updateReward();
        pool.protocol = _protocol;
        pool.allocPoint = IPlanManager(_master.getModule("PLAN"))
            .totalUsedCover(_protocol);
        totalAllocPoint = totalAllocPoint.add(pool.allocPoint);
        pool.rewardDebt = pool.allocPoint.mul(accEthPerAlloc).div(1e12);
    }

    /**
     * @notice Update alloc point when totalUsedCover updates.
     * @dev - Only Plan Manager can call this function.
     *      - Init pool if not initialized.
     * @param _protocol Protocol address.
     * @param _allocPoint New allocPoint.
    **/
    function updateAllocPoint(address _protocol, uint256 _allocPoint)
        external
        override
        onlyModule("PLAN")
    {
        PoolInfo storage pool = poolInfo[_protocol];
        if (poolInfo[_protocol].protocol == address(0)) {
            initPool(_protocol);
        } else {
            updatePool(_protocol);
            totalAllocPoint = totalAllocPoint.sub(pool.allocPoint).add(
                _allocPoint
            );
            pool.allocPoint = _allocPoint;
            pool.rewardDebt = pool.allocPoint.mul(accEthPerAlloc).div(1e12);
        }
    }

    /**
     * @notice StakeManager call this function to deposit for user.
     * @dev - Must update pool info
     *      - Must give pending reward to user.
     *      - Emit `BalanceAdded` event.
     * @param _user User address.
     * @param _protocol Protocol address.
     * @param _amount Stake amount.
     * @param _nftId NftId.
    **/
    function deposit(
        address _user,
        address _protocol,
        uint256 _amount,
        uint256 _nftId
    ) external override onlyModule("STAKE") {
        PoolInfo storage pool = poolInfo[_protocol];
        UserInfo storage user = userInfo[_protocol][_user];
        if (pool.protocol == address(0)) {
            initPool(_protocol);
        } else {
            updatePool(_protocol);
            if (user.amount > 0) {
                uint256 pending = user
                    .amount
                    .mul(pool.accEthPerShare)
                    .div(1e12)
                    .sub(user.rewardDebt);
                safeRewardTransfer(_user, _protocol, pending);
            }
        }
        user.amount = user.amount.add(_amount);
        user.rewardDebt = user.amount.mul(pool.accEthPerShare).div(1e12);
        pool.totalStaked = pool.totalStaked.add(_amount);

        emit BalanceAdded(
            _user,
            _protocol,
            _nftId,
            _amount,
            pool.totalStaked,
            block.timestamp
        );
    }

    /**
     * @notice StakeManager call this function to withdraw for user.
     * @dev - Must update pool info
     *      - Must give pending reward to user.
     *      - Emit `BalanceWithdrawn` event.
     * @param _user User address.
     * @param _protocol Protocol address.
     * @param _amount Withdraw amount.
     * @param _nftId NftId.
    **/
    function withdraw(
        address _user,
        address _protocol,
        uint256 _amount,
        uint256 _nftId
    ) public override onlyModule("STAKE") {
        PoolInfo storage pool = poolInfo[_protocol];
        UserInfo storage user = userInfo[_protocol][_user];
        require(user.amount >= _amount, "insufficient to withdraw");
        updatePool(_protocol);
        uint256 pending = user.amount.mul(pool.accEthPerShare).div(1e12).sub(
            user.rewardDebt
        );
        if (pending > 0) {
            safeRewardTransfer(_user, _protocol, pending);
        }
        user.amount = user.amount.sub(_amount);
        user.rewardDebt = user.amount.mul(pool.accEthPerShare).div(1e12);
        pool.totalStaked = pool.totalStaked.sub(_amount);

        emit BalanceWithdrawn(
            _user,
            _protocol,
            _nftId,
            _amount,
            pool.totalStaked,
            block.timestamp
        );
    }

    /**
     * @notice Claim pending reward.
     * @dev - Must update pool info
     *      - Emit `RewardPaid` event.
     * @param _protocol Protocol address.
    **/
    function claimReward(address _protocol) public {
        PoolInfo storage pool = poolInfo[_protocol];
        UserInfo storage user = userInfo[_protocol][msg.sender];

        updatePool(_protocol);
        uint256 pending = user.amount.mul(pool.accEthPerShare).div(1e12).sub(
            user.rewardDebt
        );
        user.rewardDebt = user.amount.mul(pool.accEthPerShare).div(1e12);
        if (pending > 0) {
            safeRewardTransfer(msg.sender, _protocol, pending);
        }
    }

    /**
     * @notice Claim pending reward of several protocols.
     * @dev - Must update pool info of each protocol
     *      - Emit `RewardPaid` event per protocol.
     * @param _protocols Array of protocol addresses.
    **/
    function claimRewardInBatch(address[] calldata _protocols) external {
        for (uint256 i = 0; i < _protocols.length; i += 1) {
            claimReward(_protocols[i]);
        }
    }

    /**
     * @notice Update pool info.
     * @dev - Skip if already updated.
     *      - Skip if totalStaked is zero.
     * @param _protocol Protocol address.
    **/
    function updatePool(address _protocol) public {
        PoolInfo storage pool = poolInfo[_protocol];
        if (block.number <= lastRewardBlock) {
            return;
        }
        if (pool.totalStaked == 0) {
            return;
        }

        updateReward();
        uint256 poolReward = pool.allocPoint.mul(accEthPerAlloc).div(1e12).sub(
            pool.rewardDebt
        );
        pool.accEthPerShare = pool.accEthPerShare.add(
            poolReward.mul(1e12).div(pool.totalStaked)
        );
        pool.rewardDebt = pool.allocPoint.mul(accEthPerAlloc).div(1e12);
    }

    /**
     * @notice Check contract balance to avoid tx failure.
    **/
    function safeRewardTransfer(address _to, address _protocol, uint256 _amount) internal {
        uint256 reward = Math.min(address(this).balance, _amount);
        payable(_to).transfer(reward);

        emit RewardPaid(_to, _protocol, reward, block.timestamp);
    }

    /**
     * @notice Get pending reward amount.
     * @param _user User address.
     * @param _protocol Protocol address.
     * @return pending reward amount
    **/
    function getPendingReward(address _user, address _protocol)
        public
        view
        returns (uint256)
    {
        if (rewardCycleEnd == 0 || totalAllocPoint == 0) {
            return 0;
        }

        uint256 reward = Math
            .min(rewardCycleEnd, block.number)
            .sub(lastRewardBlock)
            .mul(rewardPerBlock);
        uint256 _accEthPerAlloc = accEthPerAlloc.add(
            reward.mul(1e12).div(totalAllocPoint)
        );

        PoolInfo memory pool = poolInfo[_protocol];
        if (pool.protocol == address(0) || pool.totalStaked == 0) {
            return 0;
        }
        uint256 poolReward = pool.allocPoint.mul(_accEthPerAlloc).div(1e12).sub(
            pool.rewardDebt
        );
        uint256 _accEthPerShare = pool.accEthPerShare.add(
            poolReward.mul(1e12).div(pool.totalStaked)
        );
        UserInfo memory user = userInfo[_protocol][_user];
        return user.amount.mul(_accEthPerShare).div(1e12).sub(user.rewardDebt);
    }

    /**
     * @notice Get pending total reward amount for several protocols.
     * @param _user User address.
     * @param _protocols Array of protocol addresses.
     * @return pending reward amount
    **/
    function getTotalPendingReward(address _user, address[] memory _protocols)
        external
        view
        returns (uint256)
    {
        uint256 reward;
        for (uint256 i = 0; i < _protocols.length; i += 1) {
            reward = reward.add(getPendingReward(_user, _protocols[i]));
        }
        return reward;
    }
}
