// SPDX-License-Identifier: MIT

pragma solidity ^0.6.6;

import '../general/Ownable.sol';
import '../staking/GovernanceStaker.sol';
import '../libraries/SafeMath.sol';
import '../interfaces/IERC20.sol';
import '../interfaces/IBalanceManager.sol';
import '../interfaces/IPlanManager.sol';
import '../interfaces/IRewardManager.sol';

/**
 * @dev BorrowManager is where borrowers do all their interaction and it holds funds
 *      until they're sent to the StakeManager.
 **/
contract BalanceManager is Ownable, IBalanceManager {

    using SafeMath for uint;

    IPlanManager public planManager;

    IRewardManager public rewardManager;

    GovernanceStaker public governanceStaker;
    
    // Wallet of the developers for if a developer fee is being paid.
    address public devWallet;

    // keep track of monthly payments and start/end of those
    mapping (address => Balance) public balances;

    // user => referrer
    mapping (address => address) public referrers;

    // Percent of funds that go to development--start with 0 and can change.
    uint256 public devPercent;

    // Percent of funds referrers receive. 20 = 2%.
    uint256 public refPercent;

    // Percent of funds given to governance stakers.
    uint256 public govPercent;

    // Denominator used to when distributing tokens 1000 == 100%
    uint256 public constant DENOMINATOR = 1000;

    // With lastTime and secondPrice we can determine balance by second.
    // Second price is in ETH so we must convert.
    struct Balance {
        uint256 lastTime;
        uint256 perSecondPrice;
        uint256 lastBalance;
    }

    /**
     * @dev Call updateBalance before any action is taken by a user.
     * @param _user The user whose balance we need to update.
     **/
    modifier update(address _user)
    {
        updateBalance(_user);
        _;
    }


    /**
     * @param _planManager Address of the PlanManager contract.
     **/
    function initialize(address _planManager, address _governanceStaker, address _rewardManager, address _devWallet)
      external
      override
    {
        require(_planManager != address(0), "plan manager cannot be zero address");
        require(_governanceStaker != address(0), "governance staker cannot be zero address");
        require(_rewardManager != address(0), "reward manager cannot be zero address");
        require(address(planManager) == address(0), "Contract already initialized.");
        Ownable.initialize();
        planManager = IPlanManager(_planManager);
        governanceStaker = GovernanceStaker(_governanceStaker);
        rewardManager = IRewardManager(_rewardManager);
        devWallet = _devWallet;
        devPercent = 0;     // 0 %
        refPercent = 25;    // 2.5%
        govPercent = 75;    // 7.5%
    }

    /**
     * @dev Borrower deposits an amount of ETH to pay for coverage.
     * @param _referrer User who referred the depositor.
     **/
    function deposit(address _referrer) 
    external
    payable
    override
    update(msg.sender)
    {
        if ( referrers[msg.sender] == address(0) ) {
            referrers[msg.sender] = _referrer != address(0) ? _referrer : devWallet;
            emit ReferralAdded(_referrer, msg.sender);
        }
        
        require(msg.value > 0, "No Ether was deposited.");

        balances[msg.sender].lastBalance = balances[msg.sender].lastBalance.add(msg.value);
        balances[msg.sender].lastTime = block.timestamp;
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
    update(msg.sender)
    {
        Balance memory balance = balances[msg.sender];
        // this can be achieved by safeMath.sub
        // require(_amount <= balance.lastBalance, "Not enough balance for withdrawal.");

        balance.lastBalance = balance.lastBalance.sub(_amount);
        balances[msg.sender] = balance;
        
        _notifyBalanceChange(msg.sender);
        // think we can just use call.value()()
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
        uint256 cost = timeElapsed * balance.perSecondPrice;

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
    
        _payPercents(_user, loss);

        // Update storage balance.
        balance.lastBalance = newBalance;
        balance.lastTime = block.timestamp;
        emit Loss(_user, loss);
        
        if(newBalance == 0) {
            // do something when expired
            // maybe we should set price to zero
            // also some expiration of the plan?
            balance.perSecondPrice = 0;
            emit PriceChange(_user, 0);
        }
        
        balances[_user] = balance;
    }

    /**
     * @dev Armor controller has the ability to change the price that a user is paying for their insurance.
     * @param _user The user whose price we are changing.
     * @param _newPrice the new price per second that the user will be paying.
     **/
    function changePrice(address _user, uint256 _newPrice)
    external
    override
    update(_user)
    {
        require(msg.sender == address(planManager), "Caller is not PlanManager.");
        balances[_user].perSecondPrice = _newPrice;
        emit PriceChange(_user, _newPrice);
    }

    /**
     * @dev Send funds to governanceStaker and rewardManager (don't want to have to send them with every transaction).
    **/
    function releaseFunds()
      public
    {
       uint256 govBalance = balances[address(governanceStaker)].lastBalance;
       balances[address(governanceStaker)].lastBalance = 0;
       
       uint256 rewardBalance = balances[address(rewardManager)].lastBalance;
       balances[address(rewardManager)].lastBalance = 0;
       
       governanceStaker.notifyRewardAmount{value: govBalance}(govBalance);
       rewardManager.notifyRewardAmount{value: rewardBalance}(rewardBalance);
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
    function _payPercents(address _user, uint256 _charged)
      internal
    {
        // percents: 20 = 2%.
        uint256 refAmount = referrers[_user] != address(0) ? _charged * refPercent / DENOMINATOR : 0;
        uint256 devAmount = _charged * devPercent / DENOMINATOR;
        uint256 govAmount = _charged * govPercent / DENOMINATOR;
        uint256 nftAmount = _charged.sub(refAmount).sub(devAmount).sub(govAmount);
        
        if (refAmount > 0) {
            balances[ referrers[_user] ].lastBalance = balances[ referrers[_user] ].lastBalance.add(refAmount);
            emit AffiliatePaid(_user, referrers[_user], refAmount);
        }
        if (devAmount > 0) balances[devWallet].lastBalance = balances[devWallet].lastBalance.add(devAmount);
        if (govAmount > 0) balances[address(governanceStaker)].lastBalance = balances[address(governanceStaker)].lastBalance.add(govAmount);
        if (nftAmount > 0) balances[address(rewardManager)].lastBalance = balances[address(rewardManager)].lastBalance.add(nftAmount);
    }

    function _notifyBalanceChange(address _user) 
    internal
    {
        planManager.updateExpireTime(_user); 
    }
    
    /**
     * @dev Controller can change how much referrers are paid.
    **/
    function changeRefPercent(uint256 _newPercent)
      external
      onlyOwner
    {
        require(_newPercent <= DENOMINATOR, "new percent cannot be bigger than DENOMINATOR");
        refPercent = _newPercent;
    }
    
    /**
     * @dev Controller can change how much governance is paid.
    **/
    function changeGovPercent(uint256 _newPercent)
      external
      onlyOwner
    {
        require(_newPercent <= DENOMINATOR, "new percent cannot be bigger than DENOMINATOR");
        govPercent = _newPercent;
    }
    
    /**
     * @dev Controller can change how much developers are paid.
    **/
    function changeDevPercent(uint256 _newPercent)
      external
      onlyOwner
    {
        require(_newPercent <= DENOMINATOR, "new percent cannot be bigger than DENOMINATOR");
        devPercent = _newPercent;
    }
    
}
