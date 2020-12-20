// SPDX-License-Identifier: MIT

pragma solidity ^0.6.6;

interface IKeeperRecipient {
    function keep() external;
}

contract Keeper {
    
    IKeeperRecipient public recipient;

    function initializeKeeper(address _recipient) internal {
        recipient = IKeeperRecipient(_recipient);
    }

    modifier keep() {
        recipient.keep();
        _;
    }
}
