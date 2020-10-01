pragma solidity ^0.6.6;

import './Ownable.sol';

/**
 * @dev Directory is used to keep track of the different contract proxies in our system.
**/
contract Directory {
    
    // Address of the proxies for each contract, identified by keccak256("ContractName").
    mapping (bytes32 => address) proxyAddresses;
    
    /**
     * @dev Used by contracts to get the address of a contract in the system.
     * @param _contractName the keccak256'ed name of the contract.
     * @returns Address of the desired contract.
    **/
    function getAddress(bytes32 _contractName)
      external
      view
    return (address)
    {
        return proxyAddresses[_contractName];
    }
    
    /**
     * @dev Add, edit, or remove an address from the directory contract.
     * @param _contractName Identifying name of the contract.
     * @param _newAddress The new address the contract will have.
    **/
    function editAddress(bytes32 _contractName, address _newAddress)
      external
      onlyOwner
    {
        proxyAddresses[_contractName] = _newAddress;
    }
    
}