// Display the loading modal
const modal = document.getElementById("loading-modal");
modal.classList.add("is-active");

const progress = document.getElementById("loading-progress");

// Fetch all ModpacksCH packs, so we can list them
fetch('https://api.modpacks.ch/public/modpack/all')
  .then(response => response.json())
  .then(data => {
    progress.setAttribute("max", data.packs.length);
    requestPacks(data.packs);
  });

let allPacks = [];

const packList = document.getElementById("pack-list");
const search = document.getElementById("search");
const filter = document.getElementById("filter");

search.addEventListener("input", (e) => doSearch(e.target.value));
filter.addEventListener("change", (e) => displayPacks());

function doSearch(input) {
  input = input.toLowerCase();
  for (packEl of packList.children) {
    if (input == '') {
      packEl.classList.remove('is-hidden');
      continue;
    }

    if (packEl.children[0].textContent.toLowerCase().includes(input)) {
      packEl.classList.remove('is-hidden');
    } else {
      packEl.classList.add('is-hidden');
    }
  }
}

function requestPacks(packs) {
  for (const pack of packs) {
    fetch('https://api.modpacks.ch/public/modpack/' + pack)
      .then(response => response.json())
      .then(data => {
        progress.value = progress.value + 1
        allPacks.push(data);
        if (progress.value === progress.max) {
          displayPacks();
        }
      });
  }
}

function displayPacks() {
  if (!allPacks) {
    return;
  }
  // Wipe packlist
  packList.textContent = '';

  // Sort packs by installs
  allPacks.sort(function compareFn(a, b) {
    if (filter.value == 'name') {
      return a.name.replace('FTB ', '').localeCompare(b.name.replace('FTB ', ''))
    }
    return b[filter.value] < a[filter.value] ? -1 : b[filter.value] > a[filter.value] ? 1 : 0;
  });

  // Display packs in a list
  for (const pack of allPacks) {
    const packLink = document.createElement("a");
    packLink.setAttribute("href", "javascript:displayPack(" + pack.id + ")");
    packLink.appendChild(document.createTextNode(pack.name));

    const listItem = document.createElement("li");
    listItem.appendChild(packLink);

    packList.appendChild(listItem);
  }

  // Finally close down the modal
  modal.classList.remove("is-active");
  doSearch(search.value);
}

const packDisplay = document.getElementById("pack-display");
const packHero = document.getElementById("pack-hero");

const packName = document.getElementById("pack-name");
const packDesc = document.getElementById("pack-desc");

const versionList = document.getElementById("version-list");

function displayPack(pack) {
  packDisplay.classList.remove("is-hidden");

  fetch('https://api.modpacks.ch/public/modpack/' + pack)
    .then(response => response.json())
    .then(data => {
      // Reset
      packHero.style.backgroundImage = "";
      while (versionList.firstChild) {
        versionList.removeChild(versionList.firstChild);
      }

      packName.innerHTML = data.name;
      packDesc.innerHTML = data.synopsis;

      for (const art of data.art) {
        if (art.type === "splash") {
          packHero.style.backgroundImage = "url(" + art.url + ")";
          break;
        }
      }

      // Display versions in a list
      for (const version of data.versions.reverse()) {
        const link = document.createElement("a");
        link.setAttribute("href", "javascript:displayPackVersion(" + pack + ", " + version.id + ")");
        link.appendChild(document.createTextNode(version.name));

        const listItem = document.createElement("li");
        listItem.appendChild(link);

        versionList.appendChild(listItem);
      }
    });
}

function displayPackVersion(pack, version) {
  const headers = new Headers({
    "Accept": "application/json",
    "Content-Type": "application/json",
    "User-Agent": "modpacklauncher/@phit " + window.navigator.userAgent
  });

  fetch('https://api.modpacks.ch/public/modpack/' + pack)
    .then(response => response.json())
    .then(packData => {
        fetch('https://api.modpacks.ch/public/modpack/' + pack + '/' + version, {
          method: 'GET',
          headers: headers
        })
          .then(response => response.json())
          .then(versionData => {
            let modrinth = {
              'formatVersion': 1,
              'game': 'minecraft',
              'versionId': versionData.name,
              'name': packData.name,
              'summary': packData.synopsis,
              'files': [],
              'dependencies': {},
            };

            for (const target of versionData.targets) {
              if (target.name === 'minecraft') {
                modrinth.dependencies['minecraft'] = target.version;
              }
              else if (target.name === 'forge') {
                modrinth.dependencies['forge'] = target.version;
              }
              else if (target.name === 'fabric') {
                modrinth.dependencies['fabric-loader'] = target.version;
              }
            }

            for (const file of versionData.files) {
              let url = file.url
              if (!url && file.curseforge) {
                url = 'https://media.forgecdn.net/files/' + String(file.curseforge.file).substr(0, 4) + '/'
                  + String(file.curseforge.file).substr(4, 3).replace(/^0+/, '') + '/' + encodeURIComponent(file.name);
              }

              if (file.path.includes('ftbauxilium')) {
                continue;
              }
              modrinth.files.push({
                'path': file.path + file.name,
                'hashes': {
                  'sha1': file.sha1,
                },
                'env': {
                  'client': file.serveronly ? 'unsupported' : 'required',
                  'server': file.clientonly ? 'unsupported' : 'required',
                },
                'downloads': [
                  url,
                ],
                'fileSize': file.size,
              });
            }

            var zip = new JSZip();
            zip.file("modrinth.index.json", JSON.stringify(modrinth, null, "\t"));
            zip.generateAsync({ type: "blob" })
              .then(function (content) {
                saveAs(content, packData.name + '-' + versionData.name + '.mrpack');
              });
          });
    });
}
