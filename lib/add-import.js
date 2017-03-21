// @flow

import { parse } from 'babylon';
import generate from 'babel-generator';
import traverse from 'babel-traverse';
import * as t from 'babel-types';

type AST = any;

type Specifier = {
    type: 'ImportSpecifier' | 'ImportDefaultSpecifier' | 'ImportNamespaceSpecifier',
    imported: {
        type: 'Identifier',
        name: string
    },
    local: {
        type: 'Identifier',
        name: string
    }
};

type Source = {
    type: 'StringLiteral',
    value: string
};

type Declaration = {
    type: 'ImportDeclaration',
    specifiers: Specifier[],
    source: Source
};

type Member = {
    name: string,
    alias: string
};

/**
 * Generates Babylon AST from source code.
 *
 * @see getCode()
 *
 * @param {string} code
 * @returns {Object}
 */
const getAst = (code: string): AST =>
    parse(code, {
        sourceType: 'module'
    });

/**
 * Generates source code from Babylon AST.
 *
 * @see getAst
 *
 * @param {Object} ast
 * @param {string} source
 * @returns {string}
 */
const getCode = (ast: AST, source: string): string => {
    const { code } = generate(ast, { quotes: 'single' }, source);
    return code;
};

/**
 * Creates a Named Import Declaration.
 *
 * Named import declarations allow multiple imports from module by using a bracket annotation:
 * import { Member } from 'module-name';
 *
 * @param {Array<Object>} members
 * @param {string} moduleName
 * @returns {Object}
 */
const createNamedImportDeclaration = (members: Member[], moduleName: string): Declaration => {
    const sortedMembers = members.concat().sort((a, b) => {
        if (a.alias === b.alias) {
            throw new Error('Cannot add two members with the same name. Use an alias for either of the members.');
        }

        return a.alias < b.alias ? -1 : 1;
    });

    return t.importDeclaration(
        sortedMembers.map(member => t.importSpecifier(t.identifier(member.alias), t.identifier(member.name))),
        t.stringLiteral(moduleName)
    );
};

/**
 * Creates a Default Declaration.
 *
 * Default declarations look like this:
 * import defaultMember from 'module-name';
 *
 * @param {Object} defaultMember
 * @param {string} moduleName
 * @returns {Object}
 */
const createDefaultImportDeclaration = (defaultMember: string, moduleName: string): Declaration =>
    t.importDeclaration([t.importDefaultSpecifier(t.identifier(defaultMember))], t.stringLiteral(moduleName));

/**
 * Creates a Namespace Declaration.
 *
 * All exports from a module are imported under a certain Namespace. This looks as follows:
 * import * as name from 'my-module';
 *
 * @param {string} alias
 * @param {string} moduleName
 * @returns {Object}
 */
const createNamespaceImportDeclaration = (alias: string, moduleName: string): Declaration =>
    t.ImportDeclaration([t.importNamespaceSpecifier(t.identifier(alias))], t.stringLiteral(moduleName));

/**
 * Inserts declaration as the first child node of a given path.
 * In practice, this function prepends all generated and recognized import declarations to the Program Node.
 *
 * @param {Object} path
 * @param {Array<Object>} declarations
 */
const unshiftDeclarations = (path: any, declarations: Declaration[]): void => {
    declarations.map(declaration => path.unshiftContainer('body', declaration));
};

/**
 * Checks whether a give path is an import from node_modules.
 * @param {string} path
 * @returns {boolean}
 */
const isNodeModuleImport = (path: string): boolean => !path.startsWith('./');

const compareLocalWithNodeModule = (moduleA: string, moduleB: string): number => {
    return isNodeModuleImport(moduleA) ? 1 : -1;
};

/**
 * Sorts a list of import declarations by alphabetically by their source module name.
 *
 * @param {Array<Object>} imports
 * @returns {Array<Object>}
 */
const sortImportsBySource = (imports: Declaration[]): Declaration[] => {
    return imports.concat().sort((a, b) => {
        const moduleA = a.source.value;
        const moduleB = b.source.value;

        if (isNodeModuleImport(moduleA) || isNodeModuleImport(moduleB)) {
            return compareLocalWithNodeModule(moduleA, moduleB);
        }

        if (moduleA === moduleB) {
            return 0;
        }

        return moduleA > moduleB ? -1 : 1;
    });
};

const sortAlphabetically = (a, b) => {
    if (a === b) {
        return 0;
    }

    return a < b ? -1 : 1;
}

const isImportSpecifier = specifier => specifier.type === 'ImportSpecifier';
const isDefaultImportSpecifier = specifier => specifier.type === 'ImportDefaultSpecifier';

const sortSpecifiers = specifiers => {
    return specifiers.concat().sort((a, b) => {
        // A named import declaration should always follow a default declaration.
        if (isImportSpecifier(a) && isDefaultImportSpecifier(b)) {
            return 1;
        }

        // A default import declaration should always lead a named declaration.
        if (isDefaultImportSpecifier(a) && isImportSpecifier(b)) {
            return -1;
        }

        // If specifiers are the same, sort them by their local names:
        return sortAlphabetically(a.local.name, b.local.name);
    });
};

const mergeSpecifiers = (prevSpecifiers, nextSpecifiers) => prevSpecifiers.concat(nextSpecifiers);

/**
 * Merges multiple import declaration from the same source module.
 * If the declarations `import { Foo } from 'foo';` and `import { Bar } from 'foo';` are found,
 * this function will turn them into one `import { Bar, Foo } from 'foo';` declaration.
 *
 * @param {Array<Object>} imports
 * @returns {Array<Object>}
 */
const mergeImportsBySource = (imports: Declaration[]): Declaration[] => {
    const sources = imports.reduce(
        (dictionary, declaration) => {
            const key = declaration.source.value;

            if (dictionary[key]) {
                dictionary[key].specifiers = sortSpecifiers(
                    mergeSpecifiers(
                        dictionary[key].specifiers,
                        declaration.specifiers,
                    )
                );
                return dictionary;
            }

            dictionary[key] = declaration;
            return dictionary;
        },
        {}
    );

    // Object.values would, of course, be much nicer. But the return type is set to Array<mixed> which fucks things up.
    const keys = Object.keys(sources);
    return keys.map(key => sources[key]);
};

/**
 * Import Declarations / Members provided as a string are transformed to objects before being processed further.
 *
 * @param {Array<string|Object>} members
 * @returns {Array<Object>}
 */
const transformStringsToMembers = (members: Array<string | Member>): Member[] =>
    members.map(member => {
        if (typeof member === 'string') {
            return {
                name: member,
                alias: member
            };
        }

        return member;
    });

/**
 * Traverses the AST, collects all already provided imports and adds all existing and newly created imports to the AST.
 *
 * @param {string} code
 * @param {Object} declaration
 */
const addImport = (code: string, declaration: Declaration): string => {
    const ast = getAst(code);

    let exitedProgram = false;

    const imports = [declaration];

    traverse(ast, {
        exit(path) {
            if (t.isImportDeclaration(path.node)) {
                if (!exitedProgram) {
                    imports.push(t.importDeclaration(path.node.specifiers, path.node.source));
                    path.remove();
                }
            }
            if (t.isProgram(path.node)) {
                const freshImports = mergeImportsBySource(sortImportsBySource(imports));
                unshiftDeclarations(path, freshImports);
                exitedProgram = true;
            }
        }
    });

    return getCode(ast, code);
};

/**
 *
 * @param {*} code
 * @param {*} source
 * @param {*} declarations
 */
export const addNamedImport = (code: string, moduleName: string, ...members: Array<string | Member>): string => {
    const declarations = transformStringsToMembers(members);

    const importDeclaration = createNamedImportDeclaration(declarations, moduleName);
    return addImport(code, importDeclaration);
};

/**
 *
 * @param {*} code
 * @param {*} source
 * @param {*} declaration
 */
export const addDefaultImport = (code: string, moduleName: string, defaultMember: string): string => {
    const importDeclaration = createDefaultImportDeclaration(defaultMember, moduleName);
    return addImport(code, importDeclaration);
};

/**
 *
 * @param {*} code
 * @param {*} moduleName
 * @param {*} declaration
 */
export const addNamespaceImport = (code: string, moduleName: string, declaration: string): string => {
    const importDeclaration = createNamespaceImportDeclaration(declaration, moduleName);
    return addImport(code, importDeclaration);
};
