// SPDX-License-Identifier: (c) Armor.Fi DAO, 2021

pragma solidity ^0.6.6;

import '../general/Keeper.sol';
import '../general/ArmorModule.sol';
import '../general/BalanceExpireTracker.sol';
import '../interfaces/IERC20.sol';
import '../interfaces/IBalanceManager.sol';
import '../interfaces/IPlanManager.sol';
import '../interfaces/IRewardManager.sol';
import '../interfaces/IUtilizationFarm.sol';
/**
 * @dev BorrowManager is where borrowers do all their interaction and it holds funds
 *      until they're sent to the StakeManager.
 **/
contract BalanceManager is ArmorModule, IBalanceManager, BalanceExpireTracker {

    using SafeMath for uint256;
    using SafeMath for uint128;

    // Wallet of the developers for if a developer fee is being paid.
    address public devWallet;

    // With lastTime and secondPrice we can determine balance by second.
    struct Balance {
        uint64 lastTime;
        uint64 perSecondPrice;
        uint128 lastBalance;
    }
    
    // keep track of monthly payments and start/end of those
    mapping (address => Balance) public balances;

    // user => referrer
    mapping (address => address) public referrers;

    // Percent of funds that go to development--start with 0 and can change.
    uint128 public devPercent;

    // Percent of funds referrers receive. 20 = 2%.
    uint128 public refPercent;

    // Percent of funds given to governance stakers.
    uint128 public govPercent;

    // Denominator used to when distributing tokens 1000 == 100%
    uint128 public constant DENOMINATOR = 1000;

    // True if utilization farming is still ongoing
    bool public ufOn;

    // Mapping of shields so we don't reward them for U.F.
    mapping (address => bool) public arShields;
     
    // Block withdrawals within 1 hour of depositing.
    modifier onceAnHour {
        require(block.timestamp >= balances[msg.sender].lastTime.add(1 hours), "You must wait an hour after your last update to withdraw.");
        _;
    }

    /**
     * @dev Call updateBalance before any action is taken by a user.
     * @param _user The user whose balance we need to update.
     **/
    modifier update(address _user)
    {
        uint256 _oldBal = _updateBalance(_user);
        _;
        _updateBalanceActions(_user, _oldBal);
    }

    /**
     * @dev Keep function can be called by anyone to balances that have been expired. This pays out addresses and removes used cover.
     *      This is external because the doKeep modifier calls back to ArmorMaster, which then calls back to here (and elsewhere).
    **/
    function keep() external {
        // Restrict each keep to 2 removes max.
        for (uint256 i = 0; i < 2; i++) {
        
            if (infos[head].expiresAt != 0 && infos[head].expiresAt <= now) {
                address oldHead = address(head);
                uint256 oldBal = _updateBalance(oldHead);
                _updateBalanceActions(oldHead, oldBal);
            } else return;
            
        }
    }

    /**
     * @param _armorMaster Address of the ArmorMaster contract.
     **/
    function initialize(address _armorMaster, address _devWallet)
      external
      override
    {
        initializeModule(_armorMaster);
        devWallet = _devWallet;
        devPercent = 0;     // 0 %
        refPercent = 25;    // 2.5%
        govPercent = 0;     // 0%
        ufOn = true;
    }

    /**
     * @dev Borrower deposits an amount of ETH to pay for coverage.
     * @param _referrer User who referred the depositor.
    **/
    function deposit(address _referrer) 
      external
      payable
      override
      doKeep
      update(msg.sender)
    {
        if ( referrers[msg.sender] == address(0) ) {
            referrers[msg.sender] = _referrer != address(0) ? _referrer : devWallet;
            emit ReferralAdded(_referrer, msg.sender, block.timestamp);
        }
        
        require(msg.value > 0, "No Ether was deposited.");

        balances[msg.sender].lastBalance = uint128(balances[msg.sender].lastBalance.add(msg.value));
        emit Deposit(msg.sender, msg.value);
    }

    /**
     * @dev Borrower withdraws ETH from their balance.
     * @param _amount The amount of ETH to withdraw.
    **/
    function withdraw(uint256 _amount)
      external
      override
      onceAnHour
      doKeep
      update(msg.sender)
    {
        require(_amount > 0, "Must withdraw more than 0.");
        Balance memory balance = balances[msg.sender];

        // Since cost increases per second, it's difficult to estimate the correct amount. Withdraw it all in that case.
        if (balance.lastBalance > _amount) {
            balance.lastBalance = uint128( balance.lastBalance.sub(_amount) );
        } else {
            _amount = balance.lastBalance;
            balance.lastBalance = 0;
        }
        
        balances[msg.sender] = balance;
        msg.sender.transfer(_amount);
        emit Withdraw(msg.sender, _amount);
    }

    /**
     * @dev Find the current balance of a user to the second.
     * @param _user The user whose balance to find.
     **/
    function balanceOf(address _user)
      public
      view
      override
    returns (uint256)
    {
        Balance memory balance = balances[_user];

        // We adjust balance on chain based on how many blocks have passed.
        uint256 lastBalance = balance.lastBalance;

        uint256 timeElapsed = block.timestamp.sub(balance.lastTime);
        uint256 cost = timeElapsed.mul(balance.perSecondPrice);

        // If the elapsed time has brought balance to 0, make it 0.
        uint256 newBalance;
        if (lastBalance > cost) newBalance = lastBalance.sub(cost);
        else newBalance = 0;

        return newBalance;
    }

    /**
     * @dev Send funds to governanceStaker and rewardManager (don't want to have to send them with every transaction).
    **/
    function releaseFunds()
      public
    {
       uint256 govBalance = balances[getModule("GOVSTAKE")].lastBalance;
       // If staking contracts are sent too low of a reward, it can mess up distribution.
       if (govBalance >= 1 ether / 10) {
           IRewardManager(getModule("GOVSTAKE")).notifyRewardAmount{value: govBalance}(govBalance);
           balances[getModule("GOVSTAKE")].lastBalance = 0;
       }
       
       uint256 rewardBalance = balances[getModule("REWARD")].lastBalance;
       // If staking contracts are sent too low of a reward, it can mess up distribution.
       if (rewardBalance >= 1 ether / 10) {
           IRewardManager(getModule("REWARD")).notifyRewardAmount{value: rewardBalance}(rewardBalance);
           balances[getModule("REWARD")].lastBalance = 0;
       }
    }

    function perSecondPrice(address _user)
      external
      override
      view
    returns(uint256)
    {
        Balance memory balance = balances[_user];
        return balance.perSecondPrice;
    }
    
    /**
     * @dev PlanManager has the ability to change the price that a user is paying for their insurance.
     * @param _user The user whose price we are changing.
     * @param _newPrice the new price per second that the user will be paying.
     **/
    function changePrice(address _user, uint64 _newPrice)
      external
      override
      onlyModule("PLAN")
    {
        _updateBalance(_user);
        _priceChange(_user, _newPrice);
        if (_newPrice > 0) _adjustExpiry(_user, balances[_user].lastBalance.div(_newPrice).add(block.timestamp));
        else _adjustExpiry(_user, block.timestamp);
    }
    
    /**
     * @dev Update a borrower's balance to it's adjusted amount.
     * @param _user The address to be updated.
     **/
    function _updateBalance(address _user)
      internal
      returns (uint256 oldBalance)
    {
        Balance memory balance = balances[_user];

        oldBalance = balance.lastBalance;
        uint256 newBalance = balanceOf(_user);

        // newBalance should never be greater than last balance.
        uint256 loss = oldBalance.sub(newBalance);
    
        _payPercents(_user, uint128(loss));

        // Update storage balance.
        balance.lastBalance = uint128(newBalance);
        balance.lastTime = uint64(block.timestamp);
        emit Loss(_user, loss);
        
        balances[_user] = balance;
    }

    /**
     * @dev Actions relating to balance updates.
     * @param _user The user who we're updating.
     * @param _oldBal The original balance in the tx.
    **/
    function _updateBalanceActions(address _user, uint256 _oldBal)
      internal
    {
        Balance memory balance = balances[_user];
        if (_oldBal != balance.lastBalance && balance.perSecondPrice > 0) {
            _notifyBalanceChange(_user, balance.lastBalance, balance.perSecondPrice);
            _adjustExpiry(_user, balance.lastBalance.div(balance.perSecondPrice).add(block.timestamp));
        }
        if (balance.lastBalance == 0 && _oldBal != 0) {
            _priceChange(_user, 0);
        }
    }
    
    /**
     * @dev handle the user's balance change. this will interact with UFB
     * @param _user user's address
     * @param _newPrice user's new per sec price
     **/

    function _priceChange(address _user, uint64 _newPrice) 
      internal 
    {
        Balance memory balance = balances[_user];
        uint64 originalPrice = balance.perSecondPrice;
        
        if(originalPrice == _newPrice) {
            // no need to process
            return;
        }

        if (ufOn && !arShields[_user]) {
            if(originalPrice > _newPrice) {
                // price is decreasing
                IUtilizationFarm(getModule("UFB")).withdraw(_user, originalPrice.sub(_newPrice));
            } else {
                // price is increasing
                IUtilizationFarm(getModule("UFB")).stake(_user, _newPrice.sub(originalPrice));
            } 
        }
        
        balances[_user].perSecondPrice = _newPrice;
        emit PriceChange(_user, _newPrice);
    }
    
    /**
     * @dev Adjust when a balance expires.
     * @param _user Address of the user whose expiry we're adjusting.
     * @param _newExpiry New Unix timestamp of expiry.
    **/
    function _adjustExpiry(address _user, uint256 _newExpiry)
      internal
    {
        if (_newExpiry == block.timestamp) {
            BalanceExpireTracker.pop(uint160(_user));
        } else {
            BalanceExpireTracker.push(uint160(_user), uint64(_newExpiry));
        }
    }
    
    /**
     * @dev Balance has changed so PlanManager's expire time must be either increased or reduced.
    **/
    function _notifyBalanceChange(address _user, uint256 _newBalance, uint256 _newPerSec) 
      internal
    {
        uint256 expiry = _newBalance.div(_newPerSec).add(block.timestamp);
        IPlanManager(getModule("PLAN")).updateExpireTime(_user, expiry); 
    }
    
    /**
     * @dev Give rewards to different places.
     * @param _user User that's being charged.
     * @param _charged Amount of funds charged to the user.
    **/
    function _payPercents(address _user, uint128 _charged)
      internal
    {
        // percents: 20 = 2%.
        uint128 refAmount = referrers[_user] != address(0) ? _charged * refPercent / DENOMINATOR : 0;
        uint128 devAmount = _charged * devPercent / DENOMINATOR;
        uint128 govAmount = _charged * govPercent / DENOMINATOR;
        uint128 nftAmount = uint128( _charged.sub(refAmount).sub(devAmount).sub(govAmount) );
        
        if (refAmount > 0) {
            balances[ referrers[_user] ].lastBalance = uint128( balances[ referrers[_user] ].lastBalance.add(refAmount) );
            emit AffiliatePaid(referrers[_user], _user, refAmount, block.timestamp);
        }
        if (devAmount > 0) balances[devWallet].lastBalance = uint128( balances[devWallet].lastBalance.add(devAmount) );
        if (govAmount > 0) balances[getModule("GOVSTAKE")].lastBalance = uint128( balances[getModule("GOVSTAKE")].lastBalance.add(govAmount) );
        if (nftAmount > 0) balances[getModule("REWARD")].lastBalance = uint128( balances[getModule("REWARD")].lastBalance.add(nftAmount) );
    }
    
    /**
     * @dev Controller can change how much referrers are paid.
     * @param _newPercent New percent referrals receive from revenue. 100 == 10%.
    **/
    function changeRefPercent(uint128 _newPercent)
      external
      onlyOwner
    {
        require(_newPercent <= DENOMINATOR, "new percent cannot be bigger than DENOMINATOR");
        refPercent = _newPercent;
    }
    
    /**
     * @dev Controller can change how much governance is paid.
     * @param _newPercent New percent that governance will receive from revenue. 100 == 10%.
    **/
    function changeGovPercent(uint128 _newPercent)
      external
      onlyOwner
    {
        require(_newPercent <= DENOMINATOR, "new percent cannot be bigger than DENOMINATOR");
        govPercent = _newPercent;
    }
    
    /**
     * @dev Controller can change how much developers are paid.
     * @param _newPercent New percent that devs will receive from revenue. 100 == 10%.
    **/
    function changeDevPercent(uint128 _newPercent)
      external
      onlyOwner
    {
        require(_newPercent <= DENOMINATOR, "new percent cannot be bigger than DENOMINATOR");
        devPercent = _newPercent;
    }
    
    /**
     * @dev Toggle whether utilization farming should be on or off.
    **/
    function toggleUF()
      external
      onlyOwner
    {
        ufOn = !ufOn;
    }
    
    /**
     * @dev Toggle whether address is a shield.
    **/
    function toggleShield(address _shield)
      external
      onlyOwner
    {
        arShields[_shield] = !arShields[_shield];
    }

    // to reset the buckets
    function resetExpiry(uint160[] calldata _idxs) external onlyOwner {
        for(uint256 i = 0; i<_idxs.length; i++) {
            require(infos[_idxs[i]].expiresAt != 0, "not in linkedlist");
            BalanceExpireTracker.pop(_idxs[i]);
            BalanceExpireTracker.push(_idxs[i], infos[_idxs[i]].expiresAt);
        }
    }

    // set desired head and tail
    function _resetBucket(uint64 _bucket, uint160 _head, uint160 _tail) internal {
        require(_bucket % BUCKET_STEP == 0, "INVALID BUCKET");

        require(
            infos[infos[_tail].next].expiresAt >= _bucket + BUCKET_STEP &&
            infos[_tail].expiresAt < _bucket + BUCKET_STEP &&
            infos[_tail].expiresAt >= _bucket,
            "tail is not tail");
        require(
            infos[infos[_head].prev].expiresAt < _bucket &&
            infos[_head].expiresAt < _bucket + BUCKET_STEP &&
            infos[_head].expiresAt >= _bucket,
            "head is not head");
        checkPoints[_bucket].tail = _tail;
        checkPoints[_bucket].head = _head;
    }

    function resetBuckets(uint64[] calldata _buckets, uint160[] calldata _heads, uint160[] calldata _tails) external onlyOwner{
        for(uint256 i = 0 ; i< _buckets.length; i++){
            _resetBucket(_buckets[i], _heads[i], _tails[i]);
        }
    }
}