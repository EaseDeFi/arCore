// SPDX-License-Identifier: MIT

pragma solidity ^0.6.6;

interface IMedianizer {
    function peek() external returns(bytes32, bool);
}