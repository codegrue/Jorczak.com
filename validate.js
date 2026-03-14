var data = require('./family-tree.json');
var people = data.people;
var marriages = data.marriages;
var parentage = data.parentage;

var peopleMap = {};
people.forEach(function(p) {
  if (!p.id) { console.log('PERSON WITH NO ID:', JSON.stringify(p)); }
  peopleMap[p.id] = p;
});

marriages.forEach(function(m, i) {
  if (!m.spouseA || !m.spouseB) console.log('MARRIAGE MISSING spouseA/B at index', i, JSON.stringify(m));
  if (!peopleMap[m.spouseA]) console.log('MARRIAGE ref missing spouseA:', m.spouseA);
  if (!peopleMap[m.spouseB]) console.log('MARRIAGE ref missing spouseB:', m.spouseB);
});

parentage.forEach(function(e, i) {
  if (!e.child) console.log('PARENTAGE MISSING child at index', i, JSON.stringify(e));
  if (!e.parents || !Array.isArray(e.parents)) console.log('PARENTAGE MISSING parents array at index', i, JSON.stringify(e));
  else {
    e.parents.forEach(function(pid) {
      if (!peopleMap[pid]) console.log('PARENTAGE ref missing parent:', pid, 'for child:', e.child);
    });
    if (!peopleMap[e.child]) console.log('PARENTAGE ref missing child:', e.child);
  }
});

// Build maps as index.html does
var spousesMap = {};
marriages.forEach(function(m) {
  function addSpouse(a, b) {
    if (!spousesMap[a]) spousesMap[a] = [];
    spousesMap[a].push({ id: b, status: m.status });
  }
  addSpouse(m.spouseA, m.spouseB);
  addSpouse(m.spouseB, m.spouseA);
});

var childrenMap = {};
var parentsMap = {};
parentage.forEach(function(r) {
  parentsMap[r.child] = r.parents;
  r.parents.forEach(function(pid) {
    if (!childrenMap[pid]) childrenMap[pid] = [];
    if (childrenMap[pid].indexOf(r.child) === -1) childrenMap[pid].push(r.child);
  });
});

function getConnectedIds(rootId) {
  var visited = {};
  var queue = [rootId];
  while (queue.length) {
    var id = queue.shift();
    if (visited[id]) continue;
    visited[id] = true;
    (spousesMap[id]  || []).forEach(function(s)   { if (!visited[s.id]) queue.push(s.id); });
    (childrenMap[id] || []).forEach(function(cid) { if (!visited[cid])  queue.push(cid); });
    (parentsMap[id]  || []).forEach(function(pid) { if (!visited[pid])  queue.push(pid); });
  }
  return Object.keys(visited);
}

function findRoots() {
  var assigned = {};
  var roots = [];
  people.forEach(function(p) {
    if (assigned[p.id]) return;
    var component = getConnectedIds(p.id);
    var componentRoots = component.filter(function(id) {
      return !parentsMap[id] || parentsMap[id].length === 0;
    });
    if (componentRoots.length === 0) componentRoots = [component[0]];
    var rep = componentRoots.reduce(function(best, r) {
      var bPerson = peopleMap[best];
      var rPerson = peopleMap[r];
      var bestYear = bPerson && bPerson.birth ? parseInt(bPerson.birth.match(/\d{4}/) && bPerson.birth.match(/\d{4}/)[0]) : Infinity;
      var rYear = rPerson && rPerson.birth ? parseInt(rPerson.birth.match(/\d{4}/) && rPerson.birth.match(/\d{4}/)[0]) : Infinity;
      if (rYear !== bestYear) return rYear < bestYear ? r : best;
      var rKids = (childrenMap[r] || []).length;
      var bestKids = (childrenMap[best] || []).length;
      return rKids > bestKids ? r : best;
    });
    if (rep === undefined) {
      console.log('UNDEFINED rep for component containing:', p.id, 'componentRoots:', componentRoots);
    }
    roots.push(rep);
    component.forEach(function(id) { assigned[id] = true; });
  });
  return roots;
}

var roots = findRoots();
console.log('Total branches:', roots.length);
var undefinedRoots = roots.filter(function(r) { return r === undefined; });
if (undefinedRoots.length > 0) {
  console.log('ERROR: UNDEFINED roots:', undefinedRoots.length);
} else {
  console.log('All roots valid!');
  roots.forEach(function(r) {
    var p = peopleMap[r];
    console.log(' -', r, ':', p ? p.name : 'MISSING');
  });
}
