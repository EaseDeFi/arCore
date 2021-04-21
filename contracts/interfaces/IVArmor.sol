// SPDX-License-Identifier: (c) Armor.Fi DAO, 2021

pragma solidity ^0.6.12;
interface IVArmor {
    function getPriorTotalVotes(uint256 blockNumber) external view returns(uint96);
    function getPriorVotes(address account, uint256 blockNumber) external view returns(uint96);
}
