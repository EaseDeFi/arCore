// SPDX-License-Identifier: (c) Armor.Fi DAO, 2021

pragma solidity ^0.6.6;

import '../libraries/SafeMath.sol';

/**
 * @title Balance Expire Traker
 * @dev Keeps track of expiration of user balances.
**/
contract BalanceExpireTracker {
    
    using SafeMath for uint64;
    using SafeMath for uint256;
    
    // Don't want to keep typing address(0). Typecasting just for clarity.
    uint160 private constant EMPTY = uint160(address(0));
    
    // 3 days for each step.
    uint64 public constant BUCKET_STEP = 3 days;

    // indicates where to start from 
    // points where TokenInfo with (expiredAt / BUCKET_STEP) == index
    mapping(uint64 => Bucket) public checkPoints;

    struct Bucket {
        uint160 head;
        uint160 tail;
    }

    // points first active nft
    uint160 public head;
    // points last active nft
    uint160 public tail;

    // maps expireId to deposit info
    mapping(uint160 => ExpireMetadata) public infos; 
    
    // pack data to reduce gas
    struct ExpireMetadata {
        uint160 next; // zero if there is no further information
        uint160 prev;
        uint64 expiresAt;
    }

    function expired() internal view returns(bool) {
        if(infos[head].expiresAt == 0) {
            return false;
        }

        if(infos[head].expiresAt <= uint64(now)){
            return true;
        }

        return false;
    }

    // using typecasted expireId to save gas
    function push(uint160 expireId, uint64 expiresAt) 
      internal 
    {
        require(expireId != EMPTY, "info id address(0) cannot be supported");
        infos[expireId] = ExpireMetadata({
            next:0,
            prev:0,
            expiresAt: expiresAt
        });
    }

    function pop(uint160 expireId) internal {
        require(infos[expireId].expiresAt != 0, "Info does not exist");
        delete infos[expireId];
        //revert("Info does not exist");
    }

    uint256[50] private __gap;
}
