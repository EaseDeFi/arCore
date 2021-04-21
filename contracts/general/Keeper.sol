// SPDX-License-Identifier: MIT

pragma solidity ^0.6.6;

interface IKeeperRecipient {
    function keep(uint256 _length) external;
}
