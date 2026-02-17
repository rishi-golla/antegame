// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract FeeVault {
    // --- Errors ---
    error NotAdmin();
    error CooldownNotElapsed();
    error SweepFailed();
    error ZeroAddress();

    // --- Events ---
    event FeeReceived(address indexed from, uint256 amount);
    event FeesSwept(address indexed to, uint256 amount);
    event HotWalletUpdated(address oldWallet, address newWallet);
    event CooldownUpdated(uint256 oldCooldown, uint256 newCooldown);

    // --- State ---
    address public admin;
    address public hotWallet;
    uint256 public sweepCooldown;
    uint256 public lastSweepTime;

    modifier onlyAdmin() {
        if (msg.sender != admin) revert NotAdmin();
        _;
    }

    constructor(address _admin, address _hotWallet, uint256 _sweepCooldown) {
        if (_admin == address(0) || _hotWallet == address(0)) revert ZeroAddress();
        admin = _admin;
        hotWallet = _hotWallet;
        sweepCooldown = _sweepCooldown;
    }

    receive() external payable {
        emit FeeReceived(msg.sender, msg.value);
    }

    function sweep() external onlyAdmin {
        if (block.timestamp - lastSweepTime < sweepCooldown) revert CooldownNotElapsed();

        uint256 amount = address(this).balance;
        lastSweepTime = block.timestamp;

        (bool ok,) = hotWallet.call{value: amount}("");
        if (!ok) revert SweepFailed();

        emit FeesSwept(hotWallet, amount);
    }

    function setHotWallet(address _wallet) external onlyAdmin {
        if (_wallet == address(0)) revert ZeroAddress();
        emit HotWalletUpdated(hotWallet, _wallet);
        hotWallet = _wallet;
    }

    function setSweepCooldown(uint256 _seconds) external onlyAdmin {
        emit CooldownUpdated(sweepCooldown, _seconds);
        sweepCooldown = _seconds;
    }
}
