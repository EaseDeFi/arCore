// SPDX-License-Identifier: (c) Armor.Fi DAO, 2021

pragma solidity ^0.6.6;

import '../general/Keeper.sol';
import '../general/ArmorModule.sol';
import '../general/BalanceExpireTracker.sol';
import '../interfaces/IERC20.sol';
import '../interfaces/IBalanceManager.sol';
import '../interfaces/IPlanManager.sol';
import '../interfaces/IRewardManager.sol';
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
        updateBalance(_user);
        
        _;
        
        Balance memory balance = balances[_user];
        
        if (balance.perSecondPrice > 0) {
            uint64 expiry = uint64( balance.lastBalance.div(uint128(balance.perSecondPrice)).add(uint128(balance.lastTime)) );
            BalanceExpireTracker.push(uint160(_user), expiry);
        }
        
    }

    /**
     * @dev Keep function can be called by anyone to balances that have been expired. This pays out addresses and removes used cover.
     *      This is external because the doKeep modifier calls back to ArmorMaster, which then calls back to here (and elsewhere).
    **/
    function keep() external {
        // Restrict each keep to 3 removes max.
        for (uint256 i = 0; i < 3; i++) {
        
            if (infos[head].expiresAt != 0 && infos[head].expiresAt <= now) {
                address oldHead = address(head);
                uint256 oldPrice = balances[oldHead].perSecondPrice;
                BalanceExpireTracker.pop(head);
                updateBalance(oldHead);
        
                // Remove borrowed amount from PlanManager.        
                _notifyBalanceChange(msg.sender);
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
        // it is handled in update() function
        //balances[msg.sender].lastTime = uint64(block.timestamp);
        _notifyBalanceChange(msg.sender);
        emit Deposit(msg.sender, msg.value);
    }

    /**
     * @dev Borrower withdraws Dai from the contract.
     * @param _amount The amount of Dai to withdraw.
     **/
    function withdraw(uint256 _amount)
      external
      override
      onceAnHour
      doKeep
      update(msg.sender)
    {
        Balance memory balance = balances[msg.sender];

        // Since cost increases per second, it's difficult to estimate the correct amount. Withdraw it all in that case.
        if (balance.lastBalance > _amount) {
            balance.lastBalance = uint128( balance.lastBalance.sub(_amount) );
        } else {
            _amount = balance.lastBalance;
            balance.lastBalance = 0;
        }
        
        balances[msg.sender] = balance;
        _notifyBalanceChange(msg.sender);
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
     * @dev Update a borrower's balance to it's adjusted amount.
     * @param _user The address to be updated.
     **/
    function updateBalance(address _user)
      public
      override
    {
        Balance memory balance = balances[_user];

        // The new balance that a user will have.
        uint256 newBalance = balanceOf(_user);

        // newBalance should never be greater than last balance.
        uint256 loss = balance.lastBalance.sub(newBalance);
    
        _payPercents(_user, uint128(loss));

        // Update storage balance.
        balance.lastBalance = uint128(newBalance);
        balance.lastTime = uint64(block.timestamp);
        emit Loss(_user, loss);
        
        if (newBalance == 0) {
            _priceChange(_user, 0);
        }
        
        balances[_user] = balance;
    }

    /**
     * @dev handle the user's balance change. this will interact with UFB
     * @param _user user's address
     * @param _newPrice user's new per sec price
     **/

    function _priceChange(address _user, uint64 _newPrice) internal {
        Balance storage balance = balances[_user];
        uint64 originalPrice = balance.perSecondPrice;
        if(originalPrice == _newPrice) {
            // no need to process
            return;
        }
        if(ufOn && !arShields[_user]) {
            if(originalPrice > _newPrice) {
                // price is decreasing
                IRewardManager(getModule("UFB")).withdraw(_user, originalPrice.sub(_newPrice));
            } else {
                // price is increasing
                IRewardManager(getModule("UFB")).stake(_user, _newPrice.sub(originalPrice));
            } 
        }
        
        balance.perSecondPrice = _newPrice;
        emit PriceChange(_user, _newPrice);
    }

    /**
     * @dev Armor controller has the ability to change the price that a user is paying for their insurance.
     * @param _user The user whose price we are changing.
     * @param _newPrice the new price per second that the user will be paying.
     **/
    function changePrice(address _user, uint64 _newPrice)
      external
      override
      onlyModule("PLAN")
      update(_user)
    {
        _priceChange(_user, _newPrice);
    }

    /**
     * @dev Send funds to governanceStaker and rewardManager (don't want to have to send them with every transaction).
    **/
    function releaseFunds()
      public
    {
       uint256 govBalance = balances[getModule("GOVSTAKE")].lastBalance;
       // If staking contracts are sent too low of a reward, it can mess up distribution.
       if (govBalance > 1 ether) {
           IRewardManager(getModule("GOVSTAKE")).notifyRewardAmount{value: govBalance}(govBalance);
           balances[getModule("GOVSTAKE")].lastBalance = 0;
       }
       
       uint256 rewardBalance = balances[getModule("REWARD")].lastBalance;
       // If staking contracts are sent too low of a reward, it can mess up distribution.
       if (rewardBalance > 1 ether) {
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
        if (nftAmount > 0) balances[address(IRewardManager(getModule("REWARD")))].lastBalance = uint128( balances[address(IRewardManager(getModule("REWARD")))].lastBalance.add(nftAmount) );
    }

    /**
     * @dev Balance has changed so PlanManager's expire time must be either increased or reduced.
    **/
    function _notifyBalanceChange(address _user) 
      internal
    {
        IPlanManager(getModule("PLAN")).updateExpireTime(_user); 
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
}
