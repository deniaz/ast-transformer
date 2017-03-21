import { addDefaultImport, addNamedImport, addNamespaceImport } from '../lib';

test('add new import declaration to module without previous import declarations', () => {
    const expected = `import { Foo } from './foo';`;
    const content = ``;

    const actual = addNamedImport(content, './foo', 'Foo');

    expect(actual).toEqual(expected);
});

test('add multiple import declarations to module without previous import declarations', () => {
    const expected = `import { Bar, Baz, Foo } from './foo';`;
    const content = ``;

    const actual = addNamedImport(content, './foo', 'Foo', 'Baz', 'Bar');

    expect(actual).toEqual(expected);
});

test('add new import declaration to module with previous import declarations', () => {
    const expected = `import { Bar } from './bar';
import { Foo } from './foo';`;

    const content = `import { Bar } from './bar';`;

    const actual = addNamedImport(content, './foo', 'Foo');

    expect(actual).toEqual(expected);
});

test('add new import declaration to module with previous import declarations and ensure order by module name', () => {
    const expected = `import { Bar } from './bar';
import { Foo } from './foo';`;

    const content = `import { Foo } from './foo';`;

    const actual = addNamedImport(content, './bar', 'Bar');

    expect(actual).toEqual(expected);
});

test('add new import declaration to module with previous import declarations and ensure non-local imports to be first', () => {
    const expected = `import { Library } from 'library';
import { Bar } from './bar';`;

    const content = `import { Bar } from './bar';`;

    const actual = addNamedImport(content, 'library', 'Library');

    expect(actual).toEqual(expected);
});

test('add new default import declaration to module without any previous import declarations', () => {
    const expected = `import Foo from './foo';`;
    const content = ``;

    const actual = addDefaultImport(content, './foo', 'Foo');

    expect(actual).toEqual(expected);
});

test('add new default import declaration to module with previous import declarations', () => {
    const expected = `import Bar from './bar';
import { Foo } from './foo';`;
    const content = `import { Foo } from './foo';`;

    const actual = addDefaultImport(content, './bar', 'Bar');

    expect(actual).toEqual(expected);
});

test('add additional import specifier to already existing import declaration', () => {
    const expected = `import { Bar, Baz, Foo } from './foo';`;
    const content = `import { Bar, Foo } from './foo';`;

    const actual = addNamedImport(content, './foo', 'Baz');

    expect(actual).toEqual(expected);
});

test('add additional default import specifier to already existing import declaration', () => {
    const expected = `import Baz, { Bar, Foo } from './foo';`;
    const content = `import { Bar, Foo } from './foo';`;

    const actual = addDefaultImport(content, './foo', 'Baz');

    expect(actual).toEqual(expected);
});

test('add namespaced import specifier to module with previous import declarations', () => {
    const expected = `import Global from 'global';
import * as Bar from './bar';
import * as Foo from './foo';`;

    const content = `import * as Foo from './foo';
import Global from 'global';`;

    const actual = addNamespaceImport(content, './bar', 'Bar');

    expect(actual).toEqual(expected);
});

test('add new import declaration with an alias to module without previous import declarations', () => {
    const expected = `import { Foo as Bar } from './foo';`;
    const content = '';

    const actual = addNamedImport(content, './foo', {
        name: 'Foo',
        alias: 'Bar'
    });

    expect(actual).toEqual(expected);
});

test('throws an error when adding multiple specifiers with the same name', () => {
    expect(() => {
        addNamedImport('', './foo', 'Foo', 'Foo');
    }).toThrow();
});

test('adds additional named import specifier to module already containing an import declaration with default specifier', () => {
    const expected = `import React, { Component } from 'react';`;
    const content = `import React from 'react';`;

    const actual = addNamedImport(content, 'react', 'Component');

    expect(actual).toEqual(expected);
});

// test('add named import which is already impored', () => {
//     const content = `import { Foo } from './foo';`

//     expect(() => {
//         const blub = addNamedImport(content, './foo', 'Foo');
//     }).toThrow();
// });

// test('add named import whose name is already imported', () => {
//     const expected = '???';
//     const content = `import { Foo } from './foo';`

//     const actual = addNamedImport(content, './bar', 'Foo');
//     expect(actual).toEqual(expected);
// });
