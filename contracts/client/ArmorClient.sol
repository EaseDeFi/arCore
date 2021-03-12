// SPDX-License-Identifier: MIT

pragma solidity ^0.6.12;

import '../interfaces/IArmorClient.sol';
import '../libraries/ArmorCoreLibrary.sol';

contract ArmorClient {
    function submitProofOfLoss(uint256[] calldata _ids) external {
        require(ArmorCoreLibrary.getModule("CLAIM") == msg.sender,"only claim manager can call this function");
        for(uint256 i=0; i < _ids.length; i++){
            address payable target = payable(address(uint160(_ids[i])));
            target.transfer(0);
        }
    }
}
