// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

contract MonopolyGame is Ownable, ReentrancyGuard {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    // --- Errors ---
    error InvalidMaxPlayers();
    error BuyInTooLow();
    error GameAlreadyExists();
    error GameNotWaiting();
    error GameNotActive();
    error GameNotCancelled();
    error IncorrectBuyIn();
    error AlreadyDeposited();
    error GameFull();
    error InvalidSignature();
    error NonceAlreadyUsed();
    error NotAPlayer();
    error AlreadyRefunded();
    error TransferFailed();
    error TimeoutNotReached();
    error FeeTooHigh();
    error ZeroAddress();

    // --- Events ---
    event GameCreated(bytes32 indexed gameId, uint256 buyIn, uint256 maxPlayers);
    event PlayerJoined(bytes32 indexed gameId, address indexed player, uint256 amount);
    event GameStarted(bytes32 indexed gameId);
    event GameSettled(bytes32 indexed gameId, address indexed winner, uint256 payout);
    event GameCancelled(bytes32 indexed gameId);
    event RefundClaimed(bytes32 indexed gameId, address indexed player, uint256 amount);
    event SignerUpdated(address oldSigner, address newSigner);
    event FeeVaultUpdated(address oldVault, address newVault);
    event FeeBpsUpdated(uint256 oldBps, uint256 newBps);

    // --- Enums & Structs ---
    enum GameState { WAITING, ACTIVE, SETTLED, CANCELLED }

    struct Game {
        uint256 buyIn;
        uint256 maxPlayers;
        uint256 pot;
        uint256 startedAt;
        GameState state;
        address[] players;
        address winner;
    }

    // --- Constants ---
    uint256 public constant MAX_FEE_BPS = 1000;
    uint256 public constant MIN_BUY_IN = 1e15; // 0.001 ETH
    uint256 public constant EMERGENCY_TIMEOUT = 24 hours;

    // --- State ---
    address public gameSigner;
    address public feeVault;
    uint256 public feeBps;

    mapping(bytes32 => Game) internal _games;
    mapping(bytes32 => mapping(address => bool)) public deposited;
    mapping(bytes32 => mapping(address => bool)) public refunded;
    mapping(bytes32 => bool) public usedNonces;

    constructor(
        address _owner,
        address _gameSigner,
        address _feeVault,
        uint256 _feeBps
    ) Ownable(_owner) {
        if (_gameSigner == address(0) || _feeVault == address(0)) revert ZeroAddress();
        if (_feeBps > MAX_FEE_BPS) revert FeeTooHigh();
        gameSigner = _gameSigner;
        feeVault = _feeVault;
        feeBps = _feeBps;
    }

    // --- Core ---

    function createGame(bytes32 gameId, uint256 maxPlayers) external payable {
        if (maxPlayers < 2 || maxPlayers > 6) revert InvalidMaxPlayers();
        if (msg.value < MIN_BUY_IN) revert BuyInTooLow();
        if (_games[gameId].buyIn != 0) revert GameAlreadyExists();

        Game storage g = _games[gameId];
        g.buyIn = msg.value;
        g.maxPlayers = maxPlayers;
        g.pot = msg.value;
        g.state = GameState.WAITING;
        g.players.push(msg.sender);

        deposited[gameId][msg.sender] = true;

        emit GameCreated(gameId, msg.value, maxPlayers);
        emit PlayerJoined(gameId, msg.sender, msg.value);
    }

    function joinGame(bytes32 gameId) external payable {
        Game storage g = _games[gameId];
        if (g.state != GameState.WAITING) revert GameNotWaiting();
        if (msg.value != g.buyIn) revert IncorrectBuyIn();
        if (deposited[gameId][msg.sender]) revert AlreadyDeposited();
        if (g.players.length >= g.maxPlayers) revert GameFull();

        g.players.push(msg.sender);
        g.pot += msg.value;
        deposited[gameId][msg.sender] = true;

        emit PlayerJoined(gameId, msg.sender, msg.value);

        if (g.players.length == g.maxPlayers) {
            g.state = GameState.ACTIVE;
            g.startedAt = block.timestamp;
            emit GameStarted(gameId);
        }
    }

    // --- Settlement ---

    function claimWinnings(bytes32 gameId, bytes32 nonce, bytes calldata signature) external nonReentrant {
        Game storage g = _games[gameId];
        if (g.state != GameState.ACTIVE) revert GameNotActive();
        if (usedNonces[nonce]) revert NonceAlreadyUsed();

        bytes32 msgHash = keccak256(abi.encodePacked(gameId, msg.sender, nonce, address(this), block.chainid));
        bytes32 ethHash = msgHash.toEthSignedMessageHash();
        address recovered = ethHash.recover(signature);
        if (recovered != gameSigner) revert InvalidSignature();

        bool found;
        uint256 len = g.players.length;
        for (uint256 i; i < len;) {
            if (g.players[i] == msg.sender) {
                found = true;
                break;
            }
            unchecked { ++i; }
        }
        if (!found) revert NotAPlayer();

        usedNonces[nonce] = true;

        uint256 fee = g.pot * feeBps / 10000;
        uint256 payout = g.pot - fee;

        g.state = GameState.SETTLED;
        g.winner = msg.sender;

        if (fee > 0) {
            (bool feeOk,) = feeVault.call{value: fee}("");
            if (!feeOk) revert TransferFailed();
        }

        (bool payOk,) = msg.sender.call{value: payout}("");
        if (!payOk) revert TransferFailed();

        emit GameSettled(gameId, msg.sender, payout);
    }

    // --- Cancel & Refund ---

    function cancelGame(bytes32 gameId, bytes32 nonce, bytes calldata signature) external {
        Game storage g = _games[gameId];
        if (g.state != GameState.WAITING && g.state != GameState.ACTIVE) revert GameNotWaiting();
        if (usedNonces[nonce]) revert NonceAlreadyUsed();

        bytes32 msgHash = keccak256(abi.encodePacked("CANCEL", gameId, nonce, address(this), block.chainid));
        bytes32 ethHash = msgHash.toEthSignedMessageHash();
        address recovered = ethHash.recover(signature);
        if (recovered != gameSigner) revert InvalidSignature();

        usedNonces[nonce] = true;
        g.state = GameState.CANCELLED;

        emit GameCancelled(gameId);
    }

    function emergencyCancel(bytes32 gameId) external {
        Game storage g = _games[gameId];
        if (g.state != GameState.ACTIVE) revert GameNotActive();
        if (block.timestamp - g.startedAt < EMERGENCY_TIMEOUT) revert TimeoutNotReached();

        bool found;
        uint256 len = g.players.length;
        for (uint256 i; i < len;) {
            if (g.players[i] == msg.sender) {
                found = true;
                break;
            }
            unchecked { ++i; }
        }
        if (!found) revert NotAPlayer();

        g.state = GameState.CANCELLED;
        emit GameCancelled(gameId);
    }

    function claimRefund(bytes32 gameId) external nonReentrant {
        Game storage g = _games[gameId];
        if (g.state != GameState.CANCELLED) revert GameNotCancelled();
        if (!deposited[gameId][msg.sender]) revert NotAPlayer();
        if (refunded[gameId][msg.sender]) revert AlreadyRefunded();

        refunded[gameId][msg.sender] = true;

        (bool ok,) = msg.sender.call{value: g.buyIn}("");
        if (!ok) revert TransferFailed();

        emit RefundClaimed(gameId, msg.sender, g.buyIn);
    }

    // --- Admin ---

    function setGameSigner(address _signer) external onlyOwner {
        if (_signer == address(0)) revert ZeroAddress();
        emit SignerUpdated(gameSigner, _signer);
        gameSigner = _signer;
    }

    function setFeeVault(address _vault) external onlyOwner {
        if (_vault == address(0)) revert ZeroAddress();
        emit FeeVaultUpdated(feeVault, _vault);
        feeVault = _vault;
    }

    function setFeeBps(uint256 _bps) external onlyOwner {
        if (_bps > MAX_FEE_BPS) revert FeeTooHigh();
        emit FeeBpsUpdated(feeBps, _bps);
        feeBps = _bps;
    }

    // --- View helpers ---
    function getGame(bytes32 gameId) external view returns (
        uint256 buyIn,
        uint256 maxPlayers,
        uint256 pot,
        uint256 startedAt,
        GameState state,
        address[] memory players,
        address winner
    ) {
        Game storage g = _games[gameId];
        return (g.buyIn, g.maxPlayers, g.pot, g.startedAt, g.state, g.players, g.winner);
    }
}
