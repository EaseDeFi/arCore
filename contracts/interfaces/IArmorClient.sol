// SPDX-License-Identifier: (c) Armor.Fi DAO, 2021

pragma solidity ^0.6.12;

interface IArmorClient {
    function submitProofOfLoss(uint256[] calldata _ids) external;
}
