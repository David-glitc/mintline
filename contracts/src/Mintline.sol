// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC2981} from "@openzeppelin/contracts/token/common/ERC2981.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {Hashes} from "@openzeppelin/contracts/utils/cryptography/Hashes.sol";

/// @notice One Mintline drop: an ERC-721 collection with a BOT price, a supply cap, a per-wallet cap, an optional allowlist
/// window, EIP-2981 royalties, and art drawn on chain when the creator has no metadata host. Proceeds go to the creator. No fee.
contract MintlineCollection is ERC721, ERC2981, ReentrancyGuard {
    using Strings for uint256;
    struct Config {
        string name; string symbol; string description; string baseURI; address creator; uint256 price;
        uint32 maxSupply; uint32 perWallet; uint64 start; uint64 publicStart; bytes32 allowRoot; uint96 royaltyBps;
    }
    address public immutable creator;
    uint256 public immutable price;
    uint32 public immutable maxSupply;
    uint32 public immutable perWallet;
    uint64 public immutable start;
    uint64 public immutable publicStart;
    bytes32 public immutable allowRoot;
    /// @dev Block of creation, where the factory's Allowlist event for this collection can be found.
    uint64 public immutable createdBlock;
    string public description;
    string public baseURI;
    bool public frozen;
    uint32 public minted;
    uint256 public raised;
    mapping(address=>uint32) public mintedBy;
    event Minted(address indexed to,uint256 firstId,uint32 quantity,uint256 paid);
    event Revealed(string baseURI);
    event Withdrawn(uint256 amount);

    constructor(Config memory c) ERC721(c.name,c.symbol){
        creator=c.creator;price=c.price;maxSupply=c.maxSupply;perWallet=c.perWallet;start=c.start;publicStart=c.publicStart;allowRoot=c.allowRoot;createdBlock=uint64(block.number);
        description=c.description;baseURI=c.baseURI;frozen=bytes(c.baseURI).length>0;
        if(c.royaltyBps>0)_setDefaultRoyalty(c.creator,c.royaltyBps);
    }
    /// @param proof empty in the public window; during the allowlist window, a proof of keccak(keccak(abi.encode(wallet))).
    function mint(uint32 quantity,bytes32[] calldata proof) external payable nonReentrant {
        require(block.timestamp>=start,"not started");require(quantity>0&&quantity<=20,"1-20 per mint");
        if(block.timestamp<publicStart)require(MerkleProof.verifyCalldata(proof,allowRoot,keccak256(bytes.concat(keccak256(abi.encode(msg.sender))))),"not on the allowlist");
        require(minted+quantity<=maxSupply,"sold out");require(perWallet==0||mintedBy[msg.sender]+quantity<=perWallet,"wallet limit");
        require(msg.value==price*quantity,"send exact BOT");
        uint256 first=minted+1;minted+=quantity;mintedBy[msg.sender]+=quantity;raised+=msg.value;
        for(uint256 i;i<quantity;i++)_safeMint(msg.sender,first+i);
        emit Minted(msg.sender,first,quantity,msg.value);
    }
    function withdraw() external nonReentrant {
        uint256 n=address(this).balance;require(n>0,"nothing to withdraw");
        (bool ok,)=creator.call{value:n}("");require(ok,"transfer failed");emit Withdrawn(n);
    }
    /// @notice Set the metadata host once; the collection is frozen after that. Collections created with a host start frozen.
    function reveal(string calldata uri) external {
        require(msg.sender==creator,"not creator");require(!frozen,"metadata frozen");require(bytes(uri).length>0,"empty URI");
        frozen=true;baseURI=uri;emit Revealed(uri);
    }
    /// @dev A base ending in "/" is a folder (base + id); any other base is one shared edition URI; no base draws on-chain art.
    function tokenURI(uint256 id) public view override returns(string memory){
        _requireOwned(id);bytes memory b=bytes(baseURI);
        if(b.length>0)return b[b.length-1]=="/"?string.concat(baseURI,id.toString()):baseURI;
        string memory json=string.concat('{"name":"',name(),' #',id.toString(),'","description":"',description,'","image":"data:image/svg+xml;base64,',Base64.encode(bytes(art(id))),'"}');
        return string.concat("data:application/json;base64,",Base64.encode(bytes(json)));
    }
    /// @notice The on-chain artwork: ruled lines in a palette seeded by the collection and token id, with the edition stamp.
    function art(uint256 id) public view returns(string memory s){
        bytes32 seed=keccak256(abi.encode(address(this),id));uint256 hue=uint256(uint8(seed[0]))*360/256;
        s=string.concat('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><rect width="400" height="400" fill="hsl(',hue.toString(),',38%,11%)"/>');
        for(uint256 i;i<12;i++){
            uint256 r=uint8(seed[i+1]);uint256 y=40+i*28;uint256 x=24+(r%7)*20;uint256 w=90+(r%140);uint256 h=(hue+(r%5)*36)%360;
            s=string.concat(s,'<rect x="',x.toString(),'" y="',y.toString(),'" width="',w.toString(),'" height="',(6+r%14).toString(),'" rx="4" fill="hsl(',h.toString(),',80%,',(52+r%22).toString(),'%)"/>');
        }
        s=string.concat(s,'<circle cx="330" cy="330" r="44" fill="none" stroke="#fff" stroke-width="3" stroke-dasharray="4 5"/><text x="330" y="338" font-family="monospace" font-size="22" fill="#fff" text-anchor="middle">#',id.toString(),'</text></svg>');
    }
    function supportsInterface(bytes4 i) public view override(ERC721,ERC2981) returns(bool){return super.supportsInterface(i);}
}

/// @notice Creates Mintline collections and keeps the list for the gallery.
contract MintlineFactory {
    address[] private collections;
    mapping(address=>address[]) private byCreator;
    uint256 public constant MAX_ALLOWLIST=2000;
    event Created(address indexed collection,address indexed creator,string name,string symbol,uint256 price,uint32 maxSupply);
    /// @dev The whole allowlist, in leaf order; the root is computed here from it, so the published list is the real one.
    event Allowlist(address indexed collection,address[] wallets);
    function create(string calldata name,string calldata symbol,string calldata description,string calldata baseURI,uint256 price,uint32 maxSupply,uint32 perWallet,uint64 start,uint64 publicStart,address[] calldata allowlist,uint96 royaltyBps) external returns(address c){
        require(bytes(name).length>0&&bytes(name).length<=40&&bytes(symbol).length>0&&bytes(symbol).length<=10,"name 1-40, symbol 1-10");
        require(bytes(description).length<=280&&bytes(baseURI).length<=200,"text too long");
        // Quotes and backslashes would break the on-chain JSON, so they are refused in text that ends up in it.
        _plain(bytes(name));_plain(bytes(description));
        require(maxSupply>0&&maxSupply<=100_000,"supply 1-100000");require(royaltyBps<=1000,"royalty up to 10%");
        if(start<block.timestamp)start=uint64(block.timestamp);
        if(publicStart<start)publicStart=start;
        require(publicStart<=start+30 days,"public window within 30 days");
        require(publicStart==start||allowlist.length>0,"allowlist window needs a list");require(allowlist.length<=MAX_ALLOWLIST,"allowlist too long");
        bytes32 allowRoot;if(allowlist.length>0)allowRoot=_root(allowlist);
        c=address(new MintlineCollection(MintlineCollection.Config(name,symbol,description,baseURI,msg.sender,price,maxSupply,perWallet,start,publicStart,allowRoot,royaltyBps)));
        collections.push(c);byCreator[msg.sender].push(c);emit Created(c,msg.sender,name,symbol,price,maxSupply);
        if(allowlist.length>0)emit Allowlist(c,allowlist);
    }
    /// @dev Leaves are keccak(keccak(abi.encode(wallet))); pairs hash sorted and an odd node moves up unchanged (as Holdrop).
    function _root(address[] calldata list) private pure returns(bytes32){
        uint256 n=list.length;bytes32[] memory nodes=new bytes32[](n);
        for(uint256 i;i<n;i++)nodes[i]=keccak256(bytes.concat(keccak256(abi.encode(list[i]))));
        while(n>1){uint256 m;for(uint256 i;i<n;i+=2){nodes[m++]=i+1<n?Hashes.commutativeKeccak256(nodes[i],nodes[i+1]):nodes[i];}n=m;}
        return nodes[0];
    }
    function _plain(bytes memory b) private pure {for(uint256 i;i<b.length;i++)require(b[i]!='"'&&b[i]!="\\"&&uint8(b[i])>=0x20,"no quotes or control characters");}
    function collectionCount() external view returns(uint256){return collections.length;}
    function collectionAt(uint256 i) external view returns(address){return collections[i];}
    function collectionsOf(address creator) external view returns(address[] memory){return byCreator[creator];}
}
