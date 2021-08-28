// SPDX-License-Identifier: (c) Armor.Fi DAO, 2021

pragma solidity ^0.6.6;

import "../core/StakeManager.sol";

contract StakeManagerTest is StakeManager {
    function forceCoverMigrated(uint256 _nftId, bool _coverMigrated) external {
        coverMigrated[_nftId] = _coverMigrated;
    }
}
