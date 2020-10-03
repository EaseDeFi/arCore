pragma solidity ^0.6.6;

import '../general/SafeMath.sol';
import '../general/Ownable.sol';
import '../interfaces/IERC20.sol';

/**
 * @dev RewardManager keeps track of reward balances that yNFT stakers receive. They will be deposited as ARMOR.
**/
contract RewardManager is Ownable, SafeMath {
    
    using SafeMath for uint;
    
    IERC20 public armorToken;
    LendManager public lendManager;
    
    // Deposits list keeps track of all deposits made.
    // To keep this somewhat clean, we will only be able to deposit a max of once a day.
    Deposit[] public deposits;
    
    // Full cover cost provided by this user.
    mapping (address => uint256) userCoverCost;
    
    // Because of streaming, balance needs to keep track of a few different variables.
    mapping (address => uint256) public balances;
    
    // The last `deposits` index that the user updated on.
    mapping (address => uint256) lastIndex;
    
    // Deposit struct for every time a deposit of ARMOR tokens is made.
    // This will stream into an account over 24 hours.
    struct Deposit {
        uint256 totalStaked;
        uint256 amount;
        uint256 timestamp;
    }
    
    /**
     * @dev Must have LendManager contract to get user balances.
     * @param _lendManager Address of the LendManager contract.
    **/
    constructor(address _lendManager, address _armorToken)
      public
    {
        lendManager = LendManager(_lendManager);
        armorToken = IERC20(_armorToken);
    }
    
    /**
     * @dev User can withdraw their rewards.
     * @param _amount The amount of rewards they would like to withdraw.
    **/
    function withdraw(uint256 _amount)
      external
    {
        address user = msg.sender;
        require(_amount <= balances[user]);

        updateStake(user);
        
        balances[user] -= _amount;

        armorToken.transfer(user, _amount);
    }
    
    /**
     * @dev Update a user stake anytime stake is added or expired. Since we do this, we know user holdings at every deposit period.
     * @param _user The user whose stake we're updating.
    **/
    function updateStake(address _user)
      public
    {
        uint256 index = lastIndex[_user];
        
        // If user has been staking and is not updated, update reward, otherwise just update index.
        if (index != 0 && index != deposits.length - 1) {
            
            uint256 coverCost = userCoverCost(_user);
            uint256 reward = calculateReward(coverCost, index);
            
            balances[_user] = balances[_user].add(reward);
        
        }
        
        lastIndex[_user] = deposits.length - 1;
    }
    
    /**
     * @dev Deposit tokens to be staked. This is onlyOwner so malicious actors cannot spam the list.
     * @param _amount The amount of ARMOR to be deposited.
    **/
    function deposit(uint256 _amount)
      external
      onlyOwner
    {
        require(armorToken.transferFrom(msg.sender, address(this), _amount), "ARMOR deposit was unsuccessful.");
        
        uint256 totalStaked = lendManager.totalStakedCover();
        Deposit memory newDeposit = Deposit(totalStaked, _amount);
        deposits.push(newDeposit);
    }
    
    /**
     * @dev Calculate the staking reward that an insurer should gain. This loops through deposits and calculates reward for each new one.
     * @param _coverAmount The amount that the user had staked during these periods.
     * @param _lastIndex The last index of deposits that user was rewarded for.
    **/
    function calculateReward(uint256 _coverAmount, uint256 _lastIndex)
      internal
      view
    returns (uint256 reward)
    {
        // Loop through each new deposit and figure out what the reward for each deposit was.
        for (uint256 i = _lastIndex + 1; i < deposits.length; i++) {
            
            Deposit memory curDeposit = deposits[i];
            
            // Example with simple numbers, 10 is a buffer to ensure we don't divide by too big of a number.
            // reward = ( ( 1 * 10 ) / 2 ) * 2 ) / 10
            uint256 buffer = 1e18;
            reward = reward.add( ( ( ( _coverAmount * buffer ) / curDeposit.totalStaked ) * curDeposit.amount ) / buffer );    
        
        }
    }
    
}