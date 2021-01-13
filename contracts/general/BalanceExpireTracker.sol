// SPDX-License-Identifier: MIT

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
    
    // 1 day for each step.
    uint64 public constant BUCKET_STEP = 86400;

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

    function expired() internal view returns(bool){
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
        
        // If this is a replacement for a current balance, remove it's current link first.
        if (infos[expireId].expiresAt > 0) _remove(expireId);
        
        uint64 bucket = uint64( (expiresAt.div(BUCKET_STEP)).mul(BUCKET_STEP) );
        if (head == EMPTY) {
            // all the nfts are expired. so just add
            head = expireId;
            tail = expireId; 
            checkPoints[bucket] = Bucket(expireId, expireId);
            infos[expireId] = ExpireMetadata(EMPTY,EMPTY,expiresAt);
            
            return;
        }
            
        // there is active nft. we need to find where to push
        // first check if this expires faster than head
        if (infos[head].expiresAt >= expiresAt) {
            // pushing nft is going to expire first
            // update head
            infos[head].prev = expireId;

            infos[expireId] = ExpireMetadata(head, EMPTY, expiresAt);
            head = expireId;
            
            // update head of bucket
            Bucket storage b = checkPoints[bucket];
            b.head = expireId;
                
            if(b.tail == EMPTY) {
                // if tail is zero, this bucket was empty should fill tail with expireId
                b.tail = expireId;
            }
                
            // this case can end now
            return;
        }
          
        // then check if depositing nft will last more than latest
        if (infos[tail].expiresAt <= expiresAt) {
            infos[tail].next = expireId;

            // push nft at tail
            infos[expireId] = ExpireMetadata(EMPTY,tail,expiresAt);
            tail = expireId;
            
            // update tail of bucket
            Bucket storage b = checkPoints[bucket];
            b.tail = expireId;
            
            if(b.head == EMPTY) {
              // if head is zero, this bucket was empty should fill head with expireId
              b.head = expireId;
            }
            
            // this case is done now
            return;
        }
          
        // so our nft is somewhere in between
        if (checkPoints[bucket].head != EMPTY) {
            //bucket is not empty
            //we just need to find our neighbor in the bucket
            uint160 cursor = checkPoints[bucket].head;
        
            // iterate until we find our nft's next
            while(infos[cursor].expiresAt < expiresAt){
                cursor = infos[cursor].next;
            }
        
            infos[expireId] = ExpireMetadata(cursor, infos[cursor].prev, expiresAt);
            infos[infos[cursor].prev].next = expireId;
            infos[cursor].prev = expireId;
        
            //now update bucket's head/tail data
            Bucket storage b = checkPoints[bucket];
            
            if (infos[b.head].prev == expireId){
                b.head = expireId;
            }
            
            if (infos[b.tail].next == expireId){
                b.tail = expireId;
            }
        } else {
            //bucket is empty
            //should find which bucket has depositing nft's closest neighbor
            // step 1 find prev bucket
            uint64 prevCursor = uint64( bucket.sub(BUCKET_STEP) );
            
            while(checkPoints[prevCursor].tail == EMPTY){
              prevCursor = uint64( prevCursor.sub(BUCKET_STEP) );
            }
    
            uint160 prev = checkPoints[prevCursor].tail;
            uint160 next = infos[prev].next;
    
            // step 2 link prev buckets tail - nft - next buckets head
            infos[expireId] = ExpireMetadata(next,prev,expiresAt);
            infos[prev].next = expireId;
            infos[next].prev = expireId;
    
            checkPoints[bucket].head = expireId;
            checkPoints[bucket].tail = expireId;
        }
    }

    function pop(uint160 expireId) internal {
        uint64 expiresAt = infos[expireId].expiresAt;
        uint64 bucket = uint64( (expiresAt.div(BUCKET_STEP)).mul(BUCKET_STEP) );
        // check if bucket is empty
        // if bucket is empty, reverts
        require(checkPoints[bucket].head != EMPTY, "Info does not exist: Bucket empty");
        // if bucket is not empty, iterate through
        // if expiresAt of current cursor is larger than expiresAt of parameter, reverts
        for(uint160 cursor = checkPoints[bucket].head; infos[cursor].expiresAt <= expiresAt; cursor = infos[cursor].next) {
            ExpireMetadata memory info = infos[cursor];
            // if expiresAt is same of paramter, check if expireId is same
            if(info.expiresAt == expiresAt && cursor == expireId) {
                // if yes, delete it
                // if cursor was head, move head to cursor.next
                if(head == cursor) {
                    head = info.next;
                }
                // if cursor was tail, move tail to cursor.prev
                if(tail == cursor) {
                    tail = info.prev;
                }
                // if cursor was head of bucket
                if(checkPoints[bucket].head == cursor){
                    // and cursor.next is still in same bucket, move head to cursor.next
                    if(infos[info.next].expiresAt.div(BUCKET_STEP) == bucket.div(BUCKET_STEP)){
                        checkPoints[bucket].head == info.next;
                    } else {
                        // delete whole checkpoint if bucket is now empty
                        delete checkPoints[bucket];
                    }
                } else if(checkPoints[bucket].tail == cursor){
                    // since bucket.tail == bucket.haed == cursor case is handled at the above,
                    // we only have to handle bucket.tail == cursor != bucket.head
                    checkPoints[bucket].tail = info.prev;
                }
                // now we handled all tail/head situation, we have to connect prev and next
                infos[info.prev].next = info.next;
                infos[info.next].prev = info.prev;
                // delete info and end
                delete infos[cursor];
                return;
            }
            // if not, continue -> since there can be same expires at with multiple expireId
        }
        revert("Info does not exist.");
    }
    
    /**
     * @dev Link previous to next, effectively removing this balance expiration. New expiration data will then be pushed into place.
     * @param expireId Address of the user we are changing expiration for.
    **/
    function _remove(uint160 expireId) 
      internal
    {
        ExpireMetadata memory info = infos[expireId];
        infos[info.prev].next = info.next;
        infos[info.next].prev = info.prev;
    }

    uint256[50] private __gap;
}
