import './StakeManager.sol';

/**
 * @dev Separating this off to specifically keep track of a borrower's plans/
**/
contract PlanManager {
    
    // List of plans that a user has purchased so there is a historical record.
    mapping (address => Plan[]) plans;
    
    // StakeManager calls this when a new NFT is added to update what the price for that protocol is.
    // Cover price in DAI (1e18) of price per second per DAI covered.
    mapping (address => uint256) ynftCoverPrice;
    
    // Mapping to keep track of how much coverage we've sold for each protocol.
    // keccak256(protocol, coverCurrency) => total borrowed cover
    mapping (address => uint256) totalUsedCover;
    
    // The amount of markup for Armor's service vs. the original cover cost.
    uint256 public markup;
    
    // Mapping = protocol => cover amount
    struct Plan {
        uint128 startTime;
        uint128 endTime;
        mapping (address => uint256) coverAmounts;
        address[] protocols;
    }
    
    /**
     * @dev User can update their plan for cover amount on any protocol.
     * @param _protocols Addresses of the protocols that we want coverage for.
     * @param _coverAmounts The amount of coverage desired in FULL DAI (0 decimals).
     * @notice Let's simplify this somehow--even just splitting into different functions.
    **/
    function updatePlan(address[] _protocols, uint256[] _coverAmounts)
      external
    {
        // Need to get price of the protocol here
        require(_protocols.length == _coverAmounts.length, "Input array lengths do not match.");
        
        // Require that new amounts can be covered by coverage left
        //require()
        
        // This reverts on not enough cover. Only do check in actual update to avoid multiple loops checking coverage.
        Plans memory oldPlan = plans[msg.sender][plans[msg.sender].length - 1];
        updateTotals(_protocols, _coverAmounts, oldPlan);
        
        
        address user;
        uint256 newPricePerSec;
        uint256 _markup = markup;

        Plan memory newPlan;
        
        // Loop through protocols, find price per second, add to rate, add coverage amount to mapping.
        for (uint256 i = 0; i < _protocols.length; i++) {
            
            // Amount of DAI that must be paid per DAI of coverage per second.
            uint256 pricePerSec = ynftCoverPrice[ _protocols[i] ] * _coverAmounts[i] * _markup;
            
            newPricePerSec += pricePerSec;
            
            newPlan.coverAmounts[ _protocols[i] ] = _coverAmounts[i];
            
        }

        /**
         * @dev can for sure separate this shit into another function.
        **/
        uint256 balance = BalanceManager.balanceOf(user);
        uint256 endTime = balance / newPricePerSec + now;
        
        newPlan = (now, endTime, protocolCovers, _protocols, _coverCurrency);
        plans[user].push(newPlan);
        
        // update balance price per second here
        // They get the same price per second as long as they ke
    }
    
    /**
     * @dev Update the contract-wide totals for each protocol that has changed.
     * @notice I don't like this, how can it be better?
    **/
    function updateTotals(address[] _newProtocols, uint256[] _newCoverAmounts, bytes4[] _coverCurrency, Plan memory _oldPlan)
      internal
    {
        // Loop through all last covered protocols and amounts
        mapping memory oldCoverAmounts = _oldPlan.coverAmounts;
        uint256[] memory oldProtocols = _oldPlan.protocols;
    
        mapping memory _totalUsedCover;
        
        // First go through and subtract all old cover amounts.
        for (uint256 i = 0; i < oldProtocols.length; i++) {
            address protocol = oldProtocols[i];
            _totalUsedCover[protocol] -= oldCoverAmounts[protocol];
        }
        
        // Then go through, add new cover amounts, and make sure they do not pass cover allowed.
        for (uint256 i = 0; i < _newProtocols.length; i++) {
            _totalUsedCover[_newProtocols[i]] += _newCoverAmounts[i];
            
            // Check StakeManager to ensure the new total amount does not go above the staked amount.
            require(StakeManager.allowedCover(_totalUsedCover[_newProtocols[i]]));
        }
        
        totalUsedCover = _totalUsedCover;
    }
    
    /**
     * @dev Used by ClaimManager to check how much coverage the user had at the time of a hack.
     * @param _user The user to check coverage for.
     * @param _protocol The address of the protocol that was hacked. (Address used according to yNFT).
     * @param _hackTime The timestamp of when a hack happened.
     * @returns The amount of coverage the user had at the time--0 if none.
    **/
    function checkCoverage(address _user, address _protocol, uint256 _hackTime)
      external
      // Make sure we update balance if neede
    returns (uint256)
    {
        // This may be more gas efficient if we don't grab this first but instead grab each plan from storage individually?
        Plan[] memory planArray = plans[_user];
        
        // In normal operation, this for loop should never get too big.
        // If it does (from malicious action), the user will be the only one to suffer.
        for (uint256 i = planArray.length - 1; i >= 0; i--) {
            
            Plan memory plan = planArray[i];
            
            // Only one plan will be active at the time of a hack--return cover amount from then.
            if (_hackTime >= plan.startTime && _hackTime <= _endTime) {
                
                return plan.coverAmounts[_protocol];
            
            }
            
        }
        
        return 0;
    }
    
    /**
     * @dev Armor has the ability to change the price that a user is paying for their insurance.
     * @param _user The protocol whose yNFT price is being updated.
     * @param _newPrice the new price PER BLOCK that the user will be paying.
    **/
    function changePrice(address _protocol, uint256 _newPrice)
      external
      onlyLendManager
    {
        ynftCoverPrice[_protocol] = _newPrice;
    }
    
}