const { promises: fs } = require('fs');
const path = require('path')

const core = require('@actions/core');
// const xmlFormatter = require('ftbatch-strip-datester');
var convert = require('xml-js');

var xpath = require('xpath');
var dom = require('@xmldom/xmldom').DOMParser;

var yaml = require('js-yaml');

const select = xpath.useNamespaces({ ra: 'urn:Rockwell/MasterRecipe' });

const remove = (xpath, xml) => select(
  xpath,
  xml,
)[0]?.parentNode.removeChild(
  select(
    xpath,
    xml,
  )[0].nodeValue
)

async function run() {
  try {
    const regex = new RegExp(
      core.getInput('regex') || '^.+\.(([pP][xX][mM][lL]))$' || '.',
    )
    const directory = core.getInput('folder') || './recipes'
    fs.readFile(
      `${directory}/recipes.yml`,
    )
    .then(
      (buffer) => buffer.toString(),
    )
    .catch(
      () => '',
    )
    .then(
      (yml) => fs.readdir(
        directory,
        { withFileTypes: true },
      )
        .then(
          (dirents) => dirents
            .filter(
              (dirent) => dirent.isFile(),
            )
            .map(
              ({
                name,
              }) => name,
            )
        )
        .then(
          (files) => Promise.all(
            files.filter(
              (file) => file.match(regex)
            ).map(
              (file) => path.join(
                directory,
                file,
              ),
            )
              .map(
                (filePath) => fs.readFile(
                  filePath,
                  'utf8',
                ).then(
                  (buffer) => ({
                    filePath,
                    xml: new dom().parseFromString(
                      buffer.toString(),
                      'text/xml',
                    ),
                  }),
                ),
              )
          )
        )
        .then(
          (files) => console.log(yml) || files,
        )
        .then(
          (files) => files
            .map(
              ({
                filePath,
                xml,
              }) => ({
                filePath,
                areaModelDate: remove(
                  '/ra:RecipeElement/ra:Header/ra:AreaModelDate/text()',
                  xml,
                ) || yml[filePath]?.AreaModelDate,
                verificationDate: remove(
                  '/ra:RecipeElement/ra:Header/ra:VerificationDate/text()',
                  xml,
                ) || yml[filePath]?.verificationDate,
                xml,
              })
            )
        )
        .then(
          (docs) => fs.writeFile(
            `${core.getInput('folder') || './recipes'}/recipes.yml`,
            yaml.dump(
              docs
                .reduce(
                  (
                    acc,
                    {
                      xml,
                      filePath,
                      ...rest
                    },
                  ) => ({
                    ...acc,
                    [filePath]: rest,
                  }),
                  {},
                )
            ),
          ).then(
            () =>  Promise.all(
              docs
                .map(
                  (
                    {
                      filePath,
                      xml,
                    }
                  ) => fs.writeFile(
                    filePath,
                    xml.toString(),
                  ),
                )
            )
          )
        )
        .catch(
          (ex) => {
            console.log(ex)
            core.setFailed(ex.message)
          },
        )
    );
  }
  catch (error) {
    core.setFailed(error.message);
  }
}

run()
