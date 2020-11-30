pragma solidity ^0.6.6;

import '../general/Ownable.sol';
import '../libraries/SafeMath.sol';
import '../interfaces/IERC20.sol';
import '../interfaces/IBalanceManager.sol';
import '../interfaces/IPlanManager.sol';
//import 'hardhat/console.sol';
/**
 * @dev BorrowManager is where borrowers do all their interaction and it holds funds
 *      until they're sent to the StakeManager.
 **/
contract BalanceManager is Ownable, IBalanceManager{

    using SafeMath for uint;

    IPlanManager public planManager;

    // keep track of monthly payments and start/end of those
    mapping (address => Balance) public balances;

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
    function initialize(address _planManager)
      external
      override
    {
        require(address(planManager) == address(0), "Contract already initialized.");
        Ownable.initialize();
        planManager = IPlanManager(_planManager);
    }

    /**
     * @dev Borrower deposits an amount of Dai to pay for coverage.
     **/
    function deposit() 
    external
    payable
    override
    update(msg.sender)
    {
        require(msg.value > 0, "No Ether was deposited.");

        balances[msg.sender].lastBalance = balances[msg.sender].lastBalance.add(msg.value);
        balances[msg.sender].lastTime = block.timestamp;
        notifyBalanceChange(msg.sender);
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
        
        notifyBalanceChange(msg.sender);
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

        // Kind of a weird way to do it, but we're giving owner the balance.
        // CHANGED : _user -> owner 
        // should check if it's ok
        // I think it should go to nft stakers or something like balance pool
        balances[owner()].lastBalance += loss;

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
     * @dev Armor has the ability to change the price that a user is paying for their insurance.
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

    function perSecondPrice(address _user)
    external
    override
    view
    returns(uint256)
    {
        Balance memory balance = balances[_user];
        return balance.perSecondPrice;
    }

    function notifyBalanceChange(address _user) 
    internal
    {
        planManager.updateExpireTime(_user); 
    }
}
