// SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;

import "./IMigratorChef.sol";

abstract contract IMasterChef {
    // Info of each user.
    struct UserInfo {
        uint256 amount;     // How many LP tokens the user has provided.
        uint256 rewardDebt; // Reward debt. See explanation below.
    }

    // Info of each pool.
    struct PoolInfo {
        IERC20 lpToken;           // Address of LP token contract.
        uint256 allocPoint;       // How many allocation points assigned to this pool. SUSHIs to distribute per block.
        uint256 lastRewardBlock;  // Last block number that SUSHIs distribution occurs.
        uint256 accSushiPerShare; // Accumulated SUSHIs per share, times 1e12. See below.
    }

    PoolInfo[] public poolInfo;

    // The SUSHI TOKEN!
    function sushi() external view virtual returns(address);
    function devaddr() external view virtual returns(address);
    // Block number when bonus SUSHI period ends.
    function bonusEndBlock() external view virtual returns(uint256);
    function sushiPerBlock() external view virtual returns(uint256);
    function BONUS_MULTIPLIER() external view virtual returns(uint256);
    function migrator() external view virtual returns(IMigratorChef);
    function poolLength() external view virtual returns (uint256);
    function add(uint256 _allocPoint, IERC20 _lpToken, bool _withUpdate) external virtual;
    function set(uint256 _pid, uint256 _allocPoint, bool _withUpdate) external virtual;
    function setMigrator(IMigratorChef _migrator) external virtual;
    function migrate(uint256 _pid) external virtual;
    // Return reward multiplier over the given _from to _to block.
    function getMultiplier(uint256 _from, uint256 _to) external virtual view returns (uint256);
    // View function to see pending SUSHIs on frontend.
    function pendingSushi(uint256 _pid, address _user) external virtual view returns (uint256);
    // Update reward variables for all pools. Be careful of gas spending!
    function massUpdatePools() external virtual;
    // Update reward variables of the given pool to be up-to-date.
    function updatePool(uint256 _pid) external virtual;
    function deposit(uint256 _pid, uint256 _amount) external virtual;
    // Withdraw LP tokens from MasterChef.
    function withdraw(uint256 _pid, uint256 _amount) external virtual;
    function emergencyWithdraw(uint256 _pid) external virtual;
}
