// SPDX-License-Identifier: MIT

pragma solidity ^0.6.6;
import "hardhat/console.sol";
/**
 * @title NFT storage
 * @dev Keeps track of NFTs to allow us to easily remove them from coverage when they expire.
**/
contract NFTStorage {
    // 1 day for each step.
    uint96 public constant BUCKET_STEP = 86400;

    // indicates where to start from 
    // points where TokenInfo with (expiredAt / BUCKET_STEP) == index
    mapping(uint96 => Bucket) public checkPoints;

    struct Bucket {
        uint128 head;
        uint128 tail;
    }

    // points first active nft
    uint128 public head;
    // points last active nft
    uint128 public tail;

    // maps nftId to deposit info
    mapping(uint128 => DepositInfo) public infos; 
    
    // pack data to reduce gas
    struct DepositInfo {
        uint128 next; // zero if there is no further information
        uint128 prev;
        address owner;
        uint96 expiresAt;
    }

    function expired() internal returns(bool){
        if(infos[head].expiresAt == 0) {
            return false;
        }

        if(infos[head].expiresAt <= uint96(now)){
            return true;
        }

        return false;
    }

    /**
     * @notice Let's add SafeMath to this
    **/
    // using typecasted nftId to save gas
    function push(uint128 nftId, address user, uint96 expiresAt) 
      internal 
    {
        require(nftId != 0, "nft id 0 cannot be supported");
        uint96 bucket = (expiresAt / BUCKET_STEP) * BUCKET_STEP;
        console.logUint(bucket);        
        if (head == 0) {
            // all the nfts are expired. so just add
            head = nftId;
            tail = nftId; 
            checkPoints[bucket] = Bucket(nftId, nftId);
            infos[nftId] = DepositInfo(0,0,user,expiresAt);
            
            return;
        }
            
        // there is active nft. we need to find where to push
        // first check if this expires faster than head
        if (infos[head].expiresAt >= expiresAt) {
            // pushing nft is going to expire first
            // update head
            infos[nftId] = DepositInfo(0,head,user,expiresAt);
            head = nftId;
            
            // update head of bucket
            Bucket storage b = checkPoints[bucket];
            b.head = nftId;
                
            if(b.tail == 0) {
                // if tail is zero, this bucket was empty should fill tail with nftId
                b.tail = nftId;
            }
                
            // this case can end now
            return;
        }
          
        // then check if depositing nft will last more than latest
        if (infos[tail].expiresAt <= expiresAt) {
            // push nft at tail
            infos[nftId] = DepositInfo(tail,0,user,expiresAt);
            tail = nftId;
            
            // update tail of bucket
            Bucket storage b = checkPoints[bucket];
            b.tail = nftId;
            
            if(b.head == 0){
              // if head is zero, this bucket was empty should fill head with nftId
              b.head = nftId;
            }
            
            // this case is done now
            return;
        }
          
        // so our nft is somewhere in between
        if (checkPoints[bucket].head != 0) {
            //bucket is not empty
            //we just need to find our neighbor in the bucket
            uint128 cursor = checkPoints[bucket].head;
        
            // iterate until we find our nft's next
            while(infos[cursor].expiresAt < expiresAt){
                cursor = infos[cursor].next;
            }
        
            infos[nftId] = DepositInfo(cursor, infos[cursor].prev, user, expiresAt);
            infos[infos[cursor].prev].next = nftId;
            infos[cursor].prev = nftId;
        
            //now update bucket's head/tail data
            Bucket storage b = checkPoints[bucket];
            
            if (infos[b.head].prev == nftId){
                b.head = nftId;
            }
            
            if (infos[b.tail].next == nftId){
                b.tail = nftId;
            }
        } else {
            //bucket is empty
            //should find which bucket has depositing nft's closest neighbor
            // step 1 find prev bucket
            uint96 prevCursor = bucket - BUCKET_STEP;
            
            while(checkPoints[prevCursor].tail != 0){
              prevCursor -= BUCKET_STEP;
            }
    
            uint128 prev = checkPoints[prevCursor].tail;
            uint128 next = infos[prev].next;
    
            // step 2 link prev buckets tail - nft - next buckets head
            infos[nftId] = DepositInfo(next,prev,user,expiresAt);
            infos[prev].next = nftId;
            infos[next].prev = nftId;
    
            checkPoints[bucket].head = nftId;
            checkPoints[bucket].tail = nftId;
        }
    }

    function pop(uint256 nftId, uint96 expiresAt) internal {
        uint96 bucket = (expiresAt / BUCKET_STEP) * BUCKET_STEP;
        console.logUint(bucket);        
        // check if bucket is empty
        // if bucket is empty, reverts
        require(checkPoints[bucket].head != 0, "NFT does not exist:Bucket empty");
        // if bucket is not empty, iterate through
        // if expiresAt of current cursor is larger than expiresAt of parameter, reverts
        for(uint128 cursor = checkPoints[bucket].head; infos[cursor].expiresAt <= expiresAt; cursor = infos[cursor].next) {
            DepositInfo memory info = infos[cursor];
            // if expiresAt is same of paramter, check if nftId is same
            if(info.expiresAt == expiresAt && cursor == nftId) {
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
                    if(infos[info.next].expiresAt / BUCKET_STEP == bucket / BUCKET_STEP){
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
            // if not, continue -> since there can be same expires at with multiple nftId
        }
        revert("NFT does not exist");
    }
}
