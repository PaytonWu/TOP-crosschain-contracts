// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
//import "hardhat/console.sol";

contract Limit is AccessControl{
    //keccak256("OWNER.ROLE");
    bytes32 constant private OWNER_ROLE = 0x0eddb5b75855602b7383774e54b0f5908801044896417c7278d8b72cd62555b6;
    //keccak256("FORBIDEN.ROLE");
    bytes32 constant private FORBIDEN_ROLE = 0x3ae7ceea3d592ba264a526759c108b4d8d582ba37810bbb888fcee6f32bbf04d;

    struct Quota{
        uint256 maxTransferedToken;
        uint256 minTransferedToken;
    }

    mapping(address => Quota) public tokenQuotas;
    mapping(bytes32 => bool) public forbiddens;
    mapping(address => uint) public tokenFrozens; // unit is seconds
    uint private constant MAX_FROZEN_TIME = 15_552_000; //180 days

    constructor(){
        _setRoleAdmin(OWNER_ROLE, OWNER_ROLE);
        _setRoleAdmin(FORBIDEN_ROLE, OWNER_ROLE);
        _grantRole(OWNER_ROLE,_msgSender());
        _grantRole(FORBIDEN_ROLE,_msgSender());
    }

    function bindTransferedQuota(
        address _asset, 
        uint256 _minTransferedToken, 
        uint256 _maxTransferedToken
    ) external onlyRole(OWNER_ROLE) {
        require(_maxTransferedToken > _minTransferedToken, "max quantity of permitted token is less than the min");
        require(_maxTransferedToken < (1 << 128), "transfered token is overflow");
        tokenQuotas[_asset].maxTransferedToken = _maxTransferedToken;
        tokenQuotas[_asset].minTransferedToken = _minTransferedToken;
    }

    function checkTransferedQuota(
        address _asset,
        uint256 _amount
    ) external view returns(bool)
       Quota memory quota = tokenQuotas[_asset];
       if(quota.maxTransferedToken == 0){
         return false;
       }

       if(_amount > quota.minTransferedToken && _amount <= quota.maxTransferedToken){
         return true;
       }

       return false;
    }

    function forbiden(
        bytes32 _forbiddenId
    ) external onlyRole(FORBIDEN_ROLE) {
        require(forbiddens[_forbiddenId] == false, "id has been already forbidden");
        forbiddens[_forbiddenId] = true;
    }

    function recover(
        bytes32 _forbiddenId
    ) external onlyRole(FORBIDEN_ROLE) {
        require(forbiddens[_forbiddenId], "id has not been forbidden");
        forbiddens[_forbiddenId] = false;
    }

    function bindFrozen(
        address _asset, 
        uint _frozenDuration
    ) external onlyRole(OWNER_ROLE){
        require(_frozenDuration <= MAX_FROZEN_TIME, "freezon duration can not over 180 days");
        tokenFrozens[_asset] = _frozenDuration;
    }

    function checkFrozen(
        address _asset, 
        uint _timestamp
    ) external view returns(bool) {
        return block.timestamp >= _timestamp + tokenFrozens[_asset];
    }
}