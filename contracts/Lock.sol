// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

error Invalid__Unlock__Time(string message);
error Not__Owner(address owner);

contract Lock {
    uint private immutable i_unlockTime;
    address payable private immutable i_owner;
    string private s_label;
    address private immutable bankAddress;

    event Withdrawal(uint amount, uint when);

    receive() external payable {}

    constructor(
        uint _unlockTime,
        string memory _label,
        address _bankAddress
    ) payable {
        if (block.timestamp >= _unlockTime) {
            revert Invalid__Unlock__Time("Unlock time should be in the future");
        }
        i_unlockTime = _unlockTime;
        i_owner = payable(msg.sender);
        s_label = _label;
        bankAddress = _bankAddress;
    }

    modifier isOwner() {
        if (msg.sender != i_owner) {
            revert Not__Owner(msg.sender);
        }
        _;
    }

    function withdraw() external isOwner {
        if (block.timestamp < i_unlockTime) {
            smash();
        } else {
            emit Withdrawal(address(this).balance, block.timestamp);
            (bool success, ) = i_owner.call{value: address(this).balance}("");
            require(success);
        }
    }

    function smash() private isOwner returns (bool) {
        uint amount = address(this).balance -
            ((address(this).balance * 1) / 10);
        (bool success, ) = i_owner.call{value: amount}("");
        require(success);
        emit Withdrawal(amount, block.timestamp);
        (bool s, ) = payable(bankAddress).call{value: address(this).balance}(
            ""
        );
        return s;
    }

    function getOwner() external view returns (address owner) {
        owner = i_owner;
    }

    function getLabel() external view returns (string memory label) {
        label = s_label;
    }

    function getUnlockTime() external view returns (uint unloctTime) {
        unloctTime = i_unlockTime;
    }

    function getLockBalance() external view returns (uint balance) {
        balance = address(this).balance;
    }
}
