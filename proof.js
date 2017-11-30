const TrieNode = require('./trieNode')
const ethUtil = require('ethereumjs-util')
const matchingNibbleLength = require('./util').matchingNibbleLength

/**
 * Returns a merkle proof for a given key
 * @method Trie.prove
 * @param {Trie} trie
 * @param {String} key
 * @param {Function} cb A callback `Function` (arguments {Error} `err`, {Array.<TrieNode>} `proof`) 
 */
exports.prove = function (trie, key, cb) {
  var nodes

  trie.findPath(key, function (err, node, remaining, stack) {
    if (err) return cb(err)
    if (remaining.length > 0) return cb(new Error('Node does not contain the key'))
    nodes = stack
    var p = []
    for (var i = 0; i < nodes.length; i++) {
      var rlpNode = nodes[i].serialize()

      if ((rlpNode.length >= 32) || (i === 0)) {
        p.push(rlpNode)
      }
    }
    cb(null, p)
  })
}

/**
 * Verifies a merkle proof for a given key
 * @method Trie.verifyProof
 * @param {Buffer} rootHash
 * @param {String} key
 * @param {Array.<TrieNode>} proof
 * @param {Function} cb A callback `Function` (arguments {Error} `err`, {String} `val`) 
 */
exports.verifyProof = function (rootHash, key, proof, cb) {
  key = TrieNode.stringToNibbles(key)
  var wantHash = ethUtil.toBuffer(rootHash)
  for (var i = 0; i < proof.length; i++) {
    var p = ethUtil.toBuffer(proof[i])
    var hash = ethUtil.sha3(proof[i])
    if (Buffer.compare(hash, wantHash)) {
      return cb(new Error('bad proof node ' + i + ': hash mismatch'))
    }
    var node = new TrieNode(ethUtil.rlp.decode(p))
    var cld
    if (node.type === 'branch') {
      if (key.length === 0) {
        if (i !== proof.length - 1) {
          return cb(new Error('additional nodes at end of proof'))
        }
        return cb(null, node.value)
      }
      cld = node.raw[key[0]]
      key = key.slice(1)
      if (cld.length === 2) {
        var embeddedNode = new TrieNode(cld)
        if (i !== proof.length - 1) {
          return cb(new Error('Key does not match with the proof one'))
        }

        if (matchingNibbleLength(embeddedNode.key, key) !== embeddedNode.key.length) {
          return cb(new Error('Key does not match with the proof one'))
        }
        key = key.slice(embeddedNode.key.length)
        if (key.length !== 0) {
          return cb(new Error('Key does not match with the proof one'))
        }
        return cb(null, embeddedNode.value)
      } else {
        wantHash = cld
      }
    } else if ((node.type === 'extention') || (node.type === 'leaf')) {
      if (matchingNibbleLength(node.key, key) !== node.key.length) {
        return cb(new Error('Key does not match with the proof one'))
      }
      cld = node.value
      key = key.slice(node.key.length)
      if (key.length === 0) {
        if (i !== proof.length - 1) {
          return cb(new Error('Key does not match with the proof one'))
        }
        return cb(null, cld)
      } else {
        wantHash = cld
      }
    } else {
      return cb(new Error('Invalid node type'))
    }
  }
  cb(new Error('unexpected end of proof'))
}
