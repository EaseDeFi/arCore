pragma solidity ^0.6.6;

import '../libraries/MerkleProof.sol';
import '../interfaces/IStakeManager.sol';
import '../interfaces/IBalanceManager.sol';
import '../interfaces/IPlanManager.sol';
import '../interfaces/IClaimManager.sol';

/**
 * @dev Separating this off to specifically keep track of a borrower's plans.
**/
contract PlanManager is IPlanManager {
    
    // List of plans that a user has purchased so there is a historical record.
    mapping (address => Plan[]) public plans;
    
    // StakeManager calls this when a new NFT is added to update what the price for that protocol is.
    // Cover price in ETH (1e18) of price per second per DAI covered.
    mapping (address => uint256) public nftCoverPrice;
    
    // Mapping to keep track of how much coverage we've sold for each protocol.
    // smart contract address => total borrowed cover
    mapping (address => uint256) public totalBorrowedAmount;

    mapping (address => uint256) public totalUsedCover;
    
    // The amount of markup for Armor's service vs. the original cover cost.
    uint256 public markup;
    
    // Mapping = protocol => cover amount
    struct Plan {
        uint128 startTime;
        uint128 endTime;
        bytes32 merkleRoot;
        mapping(address => bool) claimed;
    }

    IStakeManager public stakeManager;
    IBalanceManager public balanceManager;
    IClaimManager public claimManager;
    
    function initialize(
        address _stakeManager,
        address _balanceManager,
        address _claimManager
    ) external override {
        require(stakeManager == IStakeManager(address(0)), "Contract already initialized.");
        stakeManager = IStakeManager(_stakeManager);
        balanceManager = IBalanceManager(_balanceManager);
        claimManager = IClaimManager(_claimManager);
        markup = 2;
    }

    modifier onlyStakeManager() {
        require(msg.sender == address(stakeManager), "Only StakeManager can call this function");
        _;
    }

    modifier onlyBalanceManager() {
        require(msg.sender == address(balanceManager), "Only BalanceManager can call this function");
        _;
    }
    
    modifier onlyClaimManager() {
        require(msg.sender == address(claimManager), "Only ClaimManager can call this function");
        _;
    }

    function getCurrentPlan(address _user) external view override returns(uint128 start, uint128 end,  bytes32 root){
        Plan memory plan = plans[_user][plans[_user].length-1];
        //return 0 if there is no active plan
        if(plan.endTime < now){
            start = 0;
            end = 0;
            root = bytes32(0);
        } else {
            start = plan.startTime;
            end = plan.endTime;
            root = plan.merkleRoot;
        }
    }
    
    /*
     * @dev User can update their plan for cover amount on any protocol.
     * @param _protocols Addresses of the protocols that we want coverage for.
     * @param _coverAmounts The amount of coverage desired in FULL DAI (0 decimals).
     * @notice Let's simplify this somehow--even just splitting into different functions.
    **/
    function updatePlan(address[] calldata _oldProtocols, uint256[] calldata _oldCoverAmounts, address[] calldata _protocols, uint256[] calldata _coverAmounts)
      external
      override
    {
        // Need to get price of the protocol here
        require(_protocols.length == _coverAmounts.length, "Input array lengths do not match.");
        if(plans[msg.sender].length > 0){
          Plan storage lastPlan = plans[msg.sender][plans[msg.sender].length - 1];

          require(_generateMerkleRoot(_oldProtocols, _oldCoverAmounts) == lastPlan.merkleRoot, "Invalid old values merkleRoot different");
          // First go through and subtract all old cover amounts.
          _removeOldTotals(_oldProtocols, _oldCoverAmounts);
          // Then go through, add new cover amounts, and make sure they do not pass cover allowed.
          _addNewTotals(_protocols, _coverAmounts);
          // Set old plan to have ended now.
          lastPlan.endTime = uint128(now);
        } else {
          _addNewTotals(_protocols, _coverAmounts);
        }

        uint256 newPricePerSec;
        uint256 _markup = markup;
        // Loop through protocols, find price per second, add to rate, add coverage amount to mapping.
        for (uint256 i = 0; i < _protocols.length; i++) {
            // Amount of Ether that must be paid per DAI of coverage per second.
            //check if nftCoverPrice is not zero
            require(nftCoverPrice[_protocols[i]] != 0, "Protocol is not supported");
            uint256 pricePerSec = nftCoverPrice[ _protocols[i] ] * _coverAmounts[i] * _markup;
            newPricePerSec += pricePerSec;
        }

        /**
         * @dev can for sure separate this shit into another function.
        **/
        uint256 balance = balanceManager.balanceOf(msg.sender);
        uint256 endTime = balance / newPricePerSec + now;
        
        bytes32 merkleRoot = _generateMerkleRoot(_protocols, _coverAmounts);
        Plan memory newPlan;
        newPlan = Plan(uint128(now), uint128(endTime), merkleRoot);
        plans[msg.sender].push(newPlan);
        
        // update balance price per second here
        balanceManager.changePrice(msg.sender, newPricePerSec);

        emit PlanUpdate(msg.sender, _protocols, _coverAmounts, endTime);
    }

    // should be sorted merkletree. should be calculated off chain
    function _generateMerkleRoot(address[] memory _protocols, uint256[] memory _coverAmounts) 
      internal 
      pure
    returns (bytes32)
    
    {
        require(_protocols.length == _coverAmounts.length, "protocol and coverAmount length mismatch");
        bytes32[] memory leaves = new bytes32[](_protocols.length);
        for(uint256 i = 0 ; i<_protocols.length; i++){
            bytes32 leaf = keccak256(abi.encodePacked(_protocols[i],_coverAmounts[i]));
            leaves[i] = leaf;
        }
        return MerkleProof.calculateRoot(leaves);
    }
    
    /**
     * @dev Update the contract-wide totals for each protocol that has changed.
    **/
    function _removeOldTotals(address[] memory _oldProtocols, uint256[] memory _oldCoverAmounts) internal{
        for (uint256 i = 0; i < _oldProtocols.length; i++) {
            address protocol = _oldProtocols[i];
            totalUsedCover[protocol] -= _oldCoverAmounts[i];
        }
    }

    function _addNewTotals(address[] memory _newProtocols, uint256[] memory _newCoverAmounts) internal {
        for (uint256 i = 0; i < _newProtocols.length; i++) {
            totalUsedCover[_newProtocols[i]] += _newCoverAmounts[i];
            // Check StakeManager to ensure the new total amount does not go above the staked amount.
            require(stakeManager.allowedCover(_newProtocols[i], totalUsedCover[_newProtocols[i]]), "Exceeds total cover amount");
        }
    }
    
    /**
     * @dev Used by ClaimManager to check how much coverage the user had at the time of a hack.
     * @param _user The user to check coverage for.
     * @param _protocol The address of the protocol that was hacked. (Address used according to arNFT).
     * @param _hackTime The timestamp of when a hack happened.
     * @return index index of plan for hackTime
     * @return check 
    **/
    function checkCoverage(address _user, address _protocol, uint256 _hackTime, uint256 _amount, bytes32[] calldata _path)
      external
      view
      override
      returns(uint256 index, bool check)
    {
        // This may be more gas efficient if we don't grab this first but instead grab each plan from storage individually?
        Plan[] storage planArray = plans[_user];
        
        // In normal operation, this for loop should never get too big.
        // If it does (from malicious action), the user will be the only one to suffer.
        for (int256 i = int256(planArray.length - 1); i >= 0; i--) {
            Plan storage plan = planArray[uint256(i)];
            // Only one plan will be active at the time of a hack--return cover amount from then.
            if (_hackTime >= plan.startTime && _hackTime < plan.endTime) {
                //typecast -- is it safe?
                return (uint256(i), !plan.claimed[_protocol] && MerkleProof.verify(_path, plan.merkleRoot, keccak256(abi.encodePacked(_protocol, _amount))));
            }
        }
        return (uint256(-1), false);
    }

    function planRedeemed(address _user, uint256 _planIndex, address _protocol) external override onlyClaimManager{
        Plan storage plan = plans[_user][_planIndex];
        require(plan.endTime < now, "Cannot redeem active plan, update to ");
        plan.claimed[_protocol] = true;
    }

    /**
     * @dev Armor has the ability to change the price that a user is paying for their insurance.
     * @param _protocol The protocol whose arNFT price is being updated.
     * @param _newPrice the new price PER BLOCK that the user will be paying.
    **/
    function changePrice(address _protocol, uint256 _newPrice)
      external
      override
      onlyStakeManager
    {
        nftCoverPrice[_protocol] = _newPrice;
    }

    function updateExpireTime(address _user, uint256 _balance, uint256 _pricePerSec)
      external
      override
      onlyBalanceManager
    {
        Plan storage plan = plans[_user][plans[_user].length-1];
        if(plan.endTime >= now){
            plan.endTime = uint128(_balance / _pricePerSec + now);
        }
    }
}
