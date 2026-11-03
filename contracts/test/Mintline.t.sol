// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {Test} from "forge-std/Test.sol";
import {Hashes} from "@openzeppelin/contracts/utils/cryptography/Hashes.sol";
import {MintlineFactory,MintlineCollection} from "../src/Mintline.sol";

contract MintlineTest is Test {
    address alice=address(0xA11CE);address bob=address(0xB0B);address carol=address(0xCA401);
    MintlineFactory f;
    function setUp() public {f=new MintlineFactory();vm.deal(bob,10 ether);vm.deal(carol,10 ether);}
    function wl(address a) internal pure returns(bytes32){return keccak256(bytes.concat(keccak256(abi.encode(a))));}
    function test_publicMintArtAndWithdraw() public {
        vm.prank(alice);MintlineCollection c=MintlineCollection(f.create("Night Lines","NL","Ruled light",'',0.1 ether,3,2,0,0,new address[](0),500));
        vm.prank(bob);c.mint{value:0.2 ether}(2,new bytes32[](0));
        assertEq(c.ownerOf(1),bob);assertEq(c.ownerOf(2),bob);assertEq(c.minted(),2);
        vm.prank(bob);vm.expectRevert(bytes("wallet limit"));c.mint{value:0.1 ether}(1,new bytes32[](0));
        vm.prank(carol);vm.expectRevert(bytes("send exact BOT"));c.mint{value:0.2 ether}(1,new bytes32[](0));
        vm.prank(carol);c.mint{value:0.1 ether}(1,new bytes32[](0));
        vm.prank(carol);vm.expectRevert(bytes("sold out"));c.mint{value:0.1 ether}(1,new bytes32[](0));
        string memory uri=c.tokenURI(1);assertEq(bytes(uri).length>100,true);
        assertEq(_startsWith(uri,"data:application/json;base64,"),true);
        (address r,uint256 roy)=c.royaltyInfo(1,1 ether);assertEq(r,alice);assertEq(roy,0.05 ether);
        c.withdraw();assertEq(alice.balance,0.3 ether);
        vm.prank(alice);c.reveal("ipfs://folder/");assertEq(c.tokenURI(2),"ipfs://folder/2");
        vm.prank(alice);vm.expectRevert(bytes("metadata frozen"));c.reveal("ipfs://other/");
        assertEq(f.collectionCount(),1);assertEq(f.collectionsOf(alice)[0],address(c));
    }
    function test_allowlistWindow() public {
        address[] memory list=new address[](2);list[0]=bob;list[1]=alice;
        uint64 t=uint64(vm.getBlockTimestamp());
        vm.prank(alice);MintlineCollection c=MintlineCollection(f.create("Early","E","",'ipfs://one.json',0,100,0,t,t+1 days,list,0));
        assertEq(c.allowRoot(),Hashes.commutativeKeccak256(wl(bob),wl(alice)));assertEq(c.createdBlock(),block.number);
        bytes32[] memory p=new bytes32[](1);p[0]=wl(alice);
        vm.prank(bob);c.mint(3,p);assertEq(c.balanceOf(bob),3);
        vm.prank(carol);vm.expectRevert(bytes("not on the allowlist"));c.mint(1,p);
        vm.warp(t+1 days);vm.prank(carol);c.mint(1,new bytes32[](0));
        assertEq(c.tokenURI(4),"ipfs://one.json");assertEq(c.frozen(),true);
    }
    function test_factoryRules() public {
        vm.startPrank(alice);
        vm.expectRevert(bytes("no quotes or control characters"));f.create('Bad"Name',"B","",'',0,1,0,0,0,new address[](0),0);
        vm.expectRevert(bytes("royalty up to 10%"));f.create("A","A","",'',0,1,0,0,0,new address[](0),1001);
        vm.expectRevert(bytes("allowlist window needs a list"));f.create("A","A","",'',0,1,0,0,uint64(block.timestamp+1 hours),new address[](0),0);
        MintlineCollection c=MintlineCollection(f.create("Later","L","",'',0,1,0,uint64(block.timestamp+1 hours),uint64(block.timestamp+1 hours),new address[](0),0));
        vm.expectRevert(bytes("not started"));c.mint(1,new bytes32[](0));
        vm.stopPrank();
    }
    /// @dev Every seed byte value must render: sweep enough ids to cover the hue range.
    function test_artRendersForEveryId() public {
        vm.prank(alice);MintlineCollection c=MintlineCollection(f.create("Sweep","SW","",'',0,1,0,0,0,new address[](0),0));
        for(uint256 id=1;id<=300;id++)assertGt(bytes(c.art(id)).length,500);
    }
    function _startsWith(string memory s,string memory p) internal pure returns(bool){bytes memory a=bytes(s);bytes memory b=bytes(p);if(a.length<b.length)return false;for(uint256 i;i<b.length;i++)if(a[i]!=b[i])return false;return true;}
}
