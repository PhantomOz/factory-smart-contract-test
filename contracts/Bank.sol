// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;
import {Lock} from "./Lock.sol";

error Not__Owner(address owner);

contract Bank {
    address private immutable i_owner;
    mapping(address => Lock[]) private s_ownerLocks;
    mapping(address => uint256) private s_lockIndex;

    constructor() {
        i_owner = msg.sender;
    }

    receive() external payable {}

    function lockFunds(uint _unlockTime, string memory _label) public payable {
        Lock newLock = new Lock{value: msg.value}(
            _unlockTime,
            _label,
            address(this)
        );
        s_lockIndex[address(newLock)] = getOwnerLocksLength(msg.sender);
        s_ownerLocks[msg.sender].push(newLock);
    }

    function withdrawLock(address _lock) external {
        uint index = getLockIndex(_lock);
        Lock lock = s_ownerLocks[msg.sender][index];
        lock.withdraw();
    }

    function getLockDetails(
        address _lock,
        address _owner
    )
        external
        view
        returns (uint balance, uint unlockTime, string memory label)
    {
        uint index = getLockIndex(_lock);
        Lock lock = s_ownerLocks[_owner][index];
        balance = lock.getLockBalance();
        unlockTime = lock.getUnlockTime();
        label = lock.getLabel();
    }

    function withdrawBank() external returns (bool) {
        if (msg.sender != i_owner) {
            revert Not__Owner(msg.sender);
        }
        (bool success, ) = payable(msg.sender).call{
            value: address(this).balance
        }("");
        return success;
    }

    function getOwnerLocksLength(address _owner) public view returns (uint) {
        return s_ownerLocks[_owner].length;
    }

    function getLockIndex(address _lock) public view returns (uint) {
        return s_lockIndex[_lock];
    }

    function getUserLocks(
        address _owner
    ) external view returns (Lock[] memory) {
        return s_ownerLocks[_owner];
    }

    function getOwner() external view returns (address) {
        return i_owner;
    }
}
