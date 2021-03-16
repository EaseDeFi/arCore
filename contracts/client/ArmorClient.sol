// SPDX-License-Identifier: MIT

pragma solidity ^0.6.12;

import '../interfaces/IArmorClient.sol';
import '../libraries/ArmorCore.sol';

/**
 * @dev ArmorClient is the main contract for non-Armor contracts to inherit when connecting to arCore. It contains all functionality needed for a contract to use arCore.
**/
contract ArmorClient {

    // Address that has permission to submit proof-of-loss. Armor will assign NFTs for this address to submit proof-of-loss for.
    address public armorController;

    constructor() internal {
        armorController = msg.sender;
    }

    /**
     * @dev ClaimManager calls into this contract to prompt 0 Ether transactions to addresses corresponding to NFTs that this contract must provide proof-of-loss for.
     *      This is required because of Nexus' proof-of-loss system in which an amount of proof-of-loss is required to claim cover that was paid for.
     *      EOAs would generally just sign a message to be sent in, but contracts send transactions to addresses corresponding to a cover ID (0xc1D000...000hex(coverId)).
     * @param _addresses Ethereum addresses to send 0 Ether transactions to.
    **/
    function submitProofOfLoss(address payable[] calldata _addresses) external {
        require(msg.sender == armorController || msg.sender == ArmorCore.getModule("CLAIM"),"Armor: only Armor controller or Claim Manager may call this function.");
        for(uint256 i = 0; i < _addresses.length; i++){
            _addresses[i].transfer(0);
        }
    }

    /**
     * @dev Transfer the address that is allowed to call sensitive Armor transactions (submitting proof-of-loss).
     * @param _newController Address to set as the new Armor controller. 
    **/
    function transferArmorController(address _newController) external {
        require(msg.sender == armorController, "Armor: only Armor controller may call this function.");
        armorController = _newController;
    }

}