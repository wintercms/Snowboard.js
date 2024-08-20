// @vitest-environment jsdom

import { describe, beforeEach, afterEach, it, expect } from 'vitest';

import TestInstance from '../../src/main/Snowboard';
import TestPlugin from '../fixtures/framework/TestPlugin.js';
import TestSingleton from '../fixtures/framework/TestSingleton.js';
import TestListener from '../fixtures/framework/TestListener.js';
import TestClosureListener from '../fixtures/framework/TestClosureListener.js';
import TestPromiseListener from '../fixtures/framework/TestPromiseListener.js';
import TestPromiseClosureListener from '../fixtures/framework/TestPromiseClosureListener.js';
import TestHasDependencies from '../fixtures/framework/TestHasDependencies.js';
import TestDependencyOne from '../fixtures/framework/TestDependencyOne.js';
import TestDependencyTwo from '../fixtures/framework/TestDependencyTwo.js';
import TestSingletonWithDependency from '../fixtures/framework/TestSingletonWithDependency.js';
import TestSingletonWithReady from '../fixtures/framework/TestSingletonWithReady.js';
import TestTrait from '../fixtures/framework/TestTrait.js';
import TestNotPlugin from '../fixtures/framework/TestNotPlugin.js';

describe('Snowboard framework', () => {
    beforeEach(() => {
        document.currentScript.dataset.baseUrl = 'https://example.com';
        document.currentScript.dataset.assetUrl = 'https://example.com/assets/';

        window.Snowboard = new TestInstance();
    });

    afterEach(() => {
        window.Snowboard.tearDown();
    });

    it('initialises correctly', () => {
        expect(Snowboard).toBeDefined();
        expect(Snowboard.addPlugin).toBeDefined();
        expect(Snowboard.addPlugin).toEqual(expect.any(Function));

        // Check PluginBase and Singleton abstracts exist
        expect(Snowboard.PluginBase).toBeDefined();
        expect(Snowboard.Singleton).toBeDefined();

        // Check in-built plugins
        expect(Snowboard.getPluginNames()).toEqual(
            expect.arrayContaining(['assetloader', 'cookie', 'jsonparser', 'sanitizer', 'url']),
        );
        expect(Snowboard.getPlugin('assetLoader').isSingleton()).toEqual(true);
        expect(Snowboard.getPlugin('cookie').isSingleton()).toEqual(true);
        expect(Snowboard.getPlugin('jsonparser').isSingleton()).toEqual(true);
        expect(Snowboard.getPlugin('sanitizer').isSingleton()).toEqual(true);
        expect(Snowboard.getPlugin('url').isSingleton()).toEqual(true);
    });

    it('is frozen on construction and doesn\'t allow prototype pollution', () => {
        expect(() => {
            Snowboard.newMethod = () => true;
        }).toThrow(TypeError);

        expect(() => {
            Snowboard.newProperty = 'test';
        }).toThrow(TypeError);

        expect(() => {
            Snowboard.readiness.test = 'test';
        }).toThrow(TypeError);

        expect(Snowboard.newMethod).toBeUndefined();
        expect(Snowboard.newProperty).toBeUndefined();

        // You should not be able to modify the Snowboard object fed to plugins either
        Snowboard.addPlugin('testPlugin', TestPlugin);
        const instance = Snowboard.testPlugin();
        expect(() => {
            instance.snowboard.newMethod = () => true;
        }).toThrow(TypeError);
    });

    it('doesn\'t allow core Snowboard properties and methods to be deleted', () => {
        expect(() => {
            delete Snowboard.plugins;
        }).toThrow(TypeError);

        expect(() => {
            delete Snowboard.addPlugin;
        }).toThrow(TypeError);

        expect(() => {
            delete Snowboard.globalEvent;
        }).toThrow(TypeError);
    });

    it('can add and remove a plugin', () => {
        Snowboard.addPlugin('testPlugin', TestPlugin);

        // Check plugin caller
        expect('testPlugin' in Snowboard).toEqual(true);
        expect('testSingleton' in Snowboard).toEqual(false);

        expect(Snowboard.hasPlugin('testPlugin')).toBe(true);
        expect(Snowboard.getPluginNames()).toEqual(
            expect.arrayContaining(['testplugin']),
        );

        const instance = Snowboard.testPlugin();

        // Check plugin injected methods
        expect(instance.snowboard).toBeDefined();
        expect(instance.snowboard.getPlugin).toEqual(expect.any(Function));
        expect(() => {
            instance.snowboard.initialise();
        }).toThrow('cannot use');
        expect(instance.destructor).toEqual(expect.any(Function));

        // Check plugin method
        expect(instance.testMethod).toBeDefined();
        expect(instance.testMethod).toEqual(expect.any(Function));
        expect(instance.testMethod()).toEqual('Tested');

        // Check that the plugin is not a singleton
        expect(Snowboard.getPlugin('testPlugin').isSingleton()).toEqual(false);

        // Check multiple instances
        const instanceOne = Snowboard.testPlugin();
        instanceOne.changed = true;
        const instanceTwo = Snowboard.testPlugin();
        expect(instanceOne).not.toEqual(instanceTwo);
        const factory = Snowboard.getPlugin('testPlugin');
        expect(factory.getInstances()).toEqual([instance, instanceOne, instanceTwo]);

        // Remove plugin
        Snowboard.removePlugin('testPlugin');
        expect(Snowboard.hasPlugin('testPlugin')).toEqual(false);
        expect(Snowboard.getPluginNames()).not.toEqual(
            expect.arrayContaining(['testplugin']),
        );
        expect(Snowboard.testPlugin).not.toBeDefined();
    });

    it('won\'t add a plugin that doesn\'t appear to be a plugin', () => {
        expect(() => {
            Snowboard.addPlugin('testNotPlugin', TestNotPlugin);
        }).toThrow('must extend the PluginBase class');
    });

    it('can add and remove a singleton', () => {
        Snowboard.addPlugin('testSingleton', TestSingleton);

        expect('testPlugin' in Snowboard).toEqual(false);
        expect('testSingleton' in Snowboard).toEqual(true);

        // Check plugin caller
        expect(Snowboard.hasPlugin('testSingleton')).toBe(true);
        expect(Snowboard.getPluginNames()).toEqual(
            expect.arrayContaining(['testsingleton']),
        );
        expect(Snowboard.testSingleton).toEqual(expect.any(Function));

        const instance = Snowboard.testSingleton();

        // Check plugin injected methods
        expect(instance.snowboard).toBeDefined();
        expect(instance.snowboard.getPlugin).toEqual(expect.any(Function));
        expect(() => {
            instance.snowboard.initialise();
        }).toThrow('cannot use');
        expect(instance.destructor).toEqual(expect.any(Function));

        // Check plugin method
        expect(instance.testMethod).toBeDefined();
        expect(instance.testMethod).toEqual(expect.any(Function));
        expect(instance.testMethod()).toEqual('Tested');

        // Check that the plugin is a singleton
        expect(Snowboard.getPlugin('testSingleton').isSingleton()).toEqual(true);

        // Check multiple instances  (these should all be the same as this instance is a singleton)
        const instanceOne = Snowboard.testSingleton();
        instanceOne.changed = true;
        const instanceTwo = Snowboard.testSingleton();
        expect(instanceOne).toEqual(instanceTwo);
        const factory = Snowboard.getPlugin('testSingleton');
        expect(factory.getInstances()).toEqual([instance]);

        // Remove plugin
        Snowboard.removePlugin('testSingleton');
        expect(Snowboard.hasPlugin('testSingleton')).toEqual(false);
        expect(Snowboard.getPluginNames()).not.toEqual(
            expect.arrayContaining(['testsingleton']),
        );
        expect(Snowboard.testSingleton).not.toBeDefined();
    });

    it('can remove a plugin through the delete keyword', () => {
        Snowboard.addPlugin('testPlugin', TestPlugin);

        // Remove plugin
        delete Snowboard.testPlugin;
        expect(Snowboard.hasPlugin('testPlugin')).toEqual(false);
        expect(Snowboard.getPluginNames()).not.toEqual(
            expect.arrayContaining(['testplugin']),
        );
        expect(Snowboard.testPlugin).not.toBeDefined();
    });

    it('cannot get or remove a plugin that hasn\'t been added', () => {
        expect(() => {
            Snowboard.getPlugin('notExists');
        }).toThrow('No plugin called "notExists" has been registered');

        const groupCollapsedSpy = jest.spyOn(console, 'groupCollapsed').mockImplementation(() => {});
        const traceSpy = jest.spyOn(console, 'trace').mockImplementation(() => {});
        const groupEndSpy = jest.spyOn(console, 'groupEnd').mockImplementation(() => {});

        const SnowboardDebug = new TestInstance(true);
        SnowboardDebug.removePlugin('notExists');

        expect(groupCollapsedSpy).toHaveBeenCalled();
        expect(groupCollapsedSpy).toHaveBeenLastCalledWith('%c[Snowboard]', 'color: rgb(45, 167, 199); font-weight: normal;', 'Plugin "notExists" doesn\'t exist or is already removed');
        expect(traceSpy).toHaveBeenCalled();
        expect(groupEndSpy).toHaveBeenCalled();
    });

    it('can listen and call global events', () => {
        Snowboard.addPlugin('testListener', TestListener);

        expect(Snowboard.listensToEvent('eventOne')).toEqual(['testlistener']);
        expect(Snowboard.listensToEvent('eventTwo')).toEqual(['testlistener']);
        expect(Snowboard.listensToEvent('eventThree')).toEqual([]);

        // Call global event one
        const testClass = Snowboard.testListener();
        Snowboard.globalEvent('eventOne', 42);
        expect(testClass.eventResult).toEqual('Event called with arg 42');

        // Call global event two - should fail as the test plugin doesn't have that method
        expect(() => {
            Snowboard.globalEvent('eventTwo');
        }).toThrow('Missing "notExists" method in "testlistener" plugin');

        // Call global event three - nothing should happen
        expect(() => {
            Snowboard.globalEvent('eventThree');
        }).not.toThrow();
    });

    it('can listen and call global events that are simple closures', () => {
        Snowboard.addPlugin('testClosureListener', TestClosureListener);

        expect(Snowboard.listensToEvent('eventOne')).toEqual(['testclosurelistener']);
        expect(Snowboard.listensToEvent('eventTwo')).toEqual(['testclosurelistener']);
        expect(Snowboard.listensToEvent('eventThree')).toEqual([]);

        // Call global event one
        const testClass = Snowboard.testClosureListener();
        Snowboard.globalEvent('eventOne');
        expect(testClass.eventResult).toEqual('Closure eventOne called');

        // Call global event two - should fail as the test plugin doesn't have that method
        Snowboard.globalEvent('eventTwo', 42);
        expect(testClass.eventResult).toEqual('Closure eventTwo called with arg \'42\'');

        // Call global event three - nothing should happen
        expect(() => {
            Snowboard.globalEvent('eventThree');
        }).not.toThrow();
    });

    it('can listen and call global promise events', async () => {
        Snowboard.addPlugin('test', TestPromiseListener);

        expect(Snowboard.listensToEvent('promiseOne')).toEqual(['test']);
        expect(Snowboard.listensToEvent('promiseTwo')).toEqual(['test']);
        expect(Snowboard.listensToEvent('promiseThree')).toEqual([]);

        // Call global event one
        const testClass = Snowboard.test();

        const chain = await Snowboard.globalPromiseEvent('promiseOne', 'promise').then(
            async () => {
                expect(testClass.eventResult).toEqual('Event called with arg promise');

                // Call global event two - it should still work, even though it doesn't return a
                // promise
                const innerChain = await Snowboard.globalPromiseEvent('promiseTwo', 'promise 2').then(
                    async () => {
                        expect(testClass.eventResult).toEqual('Promise two called with arg promise 2');

                        // Call global event three - it should still work
                        const innerInnerChain = await Snowboard.globalPromiseEvent('promiseThree', 'promise 3').then(
                            async () => true,
                            async (error) => error,
                        );

                        return innerInnerChain;
                    },
                    async (error) => error,
                );

                return innerChain;
            },
            async (error) => error,
        );

        expect(chain).toEqual(true);
    });

    it('can listen and call global promise events that are simple closures', async () => {
        Snowboard.addPlugin('testClosure', TestPromiseClosureListener);

        expect(Snowboard.listensToEvent('promiseOne')).toEqual(['testclosure']);
        expect(Snowboard.listensToEvent('promiseTwo')).toEqual(['testclosure']);
        expect(Snowboard.listensToEvent('promiseThree')).toEqual([]);

        // Call global event one
        const testClass = Snowboard.testClosure();
        const chain = await Snowboard.globalPromiseEvent('promiseOne', 'promise').then(
            async () => {
                expect(testClass.eventResult).toEqual('Event called with arg promise');

                // Call global event two - it should still work, even though it doesn't return a
                // promise
                const innerChain = await Snowboard.globalPromiseEvent('promiseTwo', 'promise 2').then(
                    async () => {
                        expect(testClass.eventResult).toEqual('Promise two called with arg promise 2');

                        // Call global event three - it should still work
                        const innerInnerChain = Snowboard.globalPromiseEvent('promiseThree', 'promise 3').then(
                            async () => true,
                            async (error) => error,
                        );

                        return innerInnerChain;
                    },
                    async (error) => error,
                );

                return innerChain;
            },
            async (error) => error,
        );

        expect(chain).toEqual(true);
    });

    it('will throw an error when using a plugin that has unfulfilled dependencies', () => {
        Snowboard.addPlugin('testHasDependencies', TestHasDependencies);

        expect(() => {
            Snowboard.testHasDependencies();
        }).toThrow('The "testhasdependencies" plugin requires the following plugins: testdependencyone, testdependencytwo');
    });

    it('will throw an error when using a plugin that has some unfulfilled dependencies', () => {
        Snowboard.addPlugin('testHasDependencies', TestHasDependencies);
        Snowboard.addPlugin('testDependencyOne', TestDependencyOne);

        expect(() => {
            Snowboard.testHasDependencies();
        }).toThrow('The "testhasdependencies" plugin requires the following plugins: testdependencytwo');
    });

    it('will not throw an error when using a plugin that has fulfilled dependencies', () => {
        Snowboard.addPlugin('testDependencyTwo', TestDependencyTwo);
        Snowboard.addPlugin('testHasDependencies', TestHasDependencies);
        Snowboard.addPlugin('testDependencyOne', TestDependencyOne);

        expect(() => {
            Snowboard.testHasDependencies();
        }).not.toThrow();

        expect(Snowboard.testHasDependencies().testMethod()).toEqual('Tested');
    });

    it('will not initialise a singleton that has unfulfilled dependencies', () => {
        Snowboard.addPlugin('testSingleton', TestSingletonWithDependency);

        expect(() => {
            Snowboard.testSingleton();
        }).toThrow('The "testsingleton" plugin requires the following plugins: testdependencyone');

        expect(Snowboard.listensToEvent('ready')).not.toContain('testsingleton');

        expect(() => {
            Snowboard.globalEvent('ready');
        }).not.toThrow();
    });

    it('will allow plugins to call other plugin methods', () => {
        Snowboard.addPlugin('testDependencyOne', TestDependencyOne);
        Snowboard.addPlugin('testSingleton', TestSingletonWithDependency);

        const instance = Snowboard.testSingleton();

        expect(instance.dependencyTest()).toEqual('Tested');
    });

    it('doesn\'t allow PluginBase or Singleton abstracts to be modified', () => {
        expect(() => {
            Snowboard.PluginBase.newMethod = () => true;
        }).toThrow(TypeError);

        expect(() => {
            Snowboard.PluginBase.destruct = () => true;
        }).toThrow(TypeError);

        expect(() => {
            Snowboard.PluginBase.prototype.newMethod = () => true;
        }).toThrow(TypeError);

        expect(() => {
            Snowboard.Singleton.newMethod = () => true;
        }).toThrow(TypeError);

        expect(() => {
            Snowboard.Singleton.destruct = () => true;
        }).toThrow(TypeError);

        expect(() => {
            Snowboard.Singleton.prototype.newMethod = () => true;
        }).toThrow(TypeError);
    });

    it('auto-initializes singletons on DOM ready', () => {
        Snowboard.addPlugin('testSingleton', TestSingletonWithReady);

        const event = new Event('DOMContentLoaded');
        window.dispatchEvent(event);

        expect(Snowboard.testSingleton().notReady).toEqual(false);
    });

    it('won\'t allow two plugins to share the same name', () => {
        Snowboard.addPlugin('testSingleton', TestSingleton);

        expect(() => {
            Snowboard.addPlugin('testSingleton', TestSingletonWithReady);
        }).toThrow('already registered');
    });

    it('won\'t allow a plugin that does not extend PluginBase or Singleton abstracts', () => {
        expect(() => {
            Snowboard.addPlugin('testPlugin', TestTrait);
        }).toThrow('must extend the PluginBase class');
    });

    it('won\'t allow a plugin to be named the same as a core Snowboard method', () => {
        expect(() => {
            Snowboard.addPlugin('addPlugin', TestPlugin);
        }).toThrow('already in use');

        expect(() => {
            Snowboard.addPlugin('getPlugins', TestPlugin);
        }).toThrow('already in use');

        expect(() => {
            Snowboard.addPlugin('registerTrait', TestPlugin);
        }).toThrow('already in use');

        expect(() => {
            Snowboard.addPlugin('listensToEvent', TestPlugin);
        }).toThrow('already in use');
    });

    it('can log messages', () => {
        const groupCollapsedSpy = jest.spyOn(console, 'groupCollapsed').mockImplementation(() => {});
        const traceSpy = jest.spyOn(console, 'trace').mockImplementation(() => {});
        const groupEndSpy = jest.spyOn(console, 'groupEnd').mockImplementation(() => {});

        Snowboard.log('Test message');

        expect(groupCollapsedSpy).toHaveBeenCalledTimes(1);
        expect(groupCollapsedSpy).toHaveBeenCalledWith('%c[Snowboard]', 'color: rgb(45, 167, 199); font-weight: normal;', 'Test message');
        expect(traceSpy).toHaveBeenCalledTimes(1);
        expect(groupEndSpy).toHaveBeenCalledTimes(1);
    });

    it('can log debug messages when debug mode is on', () => {
        const groupCollapsedSpy = jest.spyOn(console, 'groupCollapsed').mockImplementation(() => {});
        const traceSpy = jest.spyOn(console, 'trace').mockImplementation(() => {});
        const groupEndSpy = jest.spyOn(console, 'groupEnd').mockImplementation(() => {});

        const SnowboardDebug = new TestInstance(true);

        SnowboardDebug.debug('Test message');

        expect(groupCollapsedSpy).toHaveBeenCalled();
        expect(groupCollapsedSpy).toHaveBeenLastCalledWith('%c[Snowboard]', 'color: rgb(45, 167, 199); font-weight: normal;', 'Test message');
        expect(traceSpy).toHaveBeenCalled();
        expect(groupEndSpy).toHaveBeenCalled();
    });

    it('won\'t log debug messages when debug mode is off', () => {
        const groupCollapsedSpy = jest.spyOn(console, 'groupCollapsed').mockImplementation(() => {});
        const traceSpy = jest.spyOn(console, 'trace').mockImplementation(() => {});
        const groupEndSpy = jest.spyOn(console, 'groupEnd').mockImplementation(() => {});

        Snowboard.debug('Test message');

        expect(groupCollapsedSpy).not.toHaveBeenCalled();
        expect(traceSpy).not.toHaveBeenCalled();
        expect(groupEndSpy).not.toHaveBeenCalled();
    });

    it('can log warning messages when debug mode is on', () => {
        const groupCollapsedSpy = jest.spyOn(console, 'groupCollapsed').mockImplementation(() => {});
        const traceSpy = jest.spyOn(console, 'trace').mockImplementation(() => {});
        const groupEndSpy = jest.spyOn(console, 'groupEnd').mockImplementation(() => {});

        const SnowboardDebug = new TestInstance(true);

        SnowboardDebug.warning('Test message');

        expect(groupCollapsedSpy).toHaveBeenCalled();
        expect(groupCollapsedSpy).toHaveBeenLastCalledWith('%c[Snowboard]', 'color: rgb(229, 179, 71); font-weight: bold;', 'Test message');
        expect(traceSpy).toHaveBeenCalled();
        expect(groupEndSpy).toHaveBeenCalled();
    });

    it('won\'t log warning messages when debug mode is off', () => {
        const groupCollapsedSpy = jest.spyOn(console, 'groupCollapsed').mockImplementation(() => {});
        const traceSpy = jest.spyOn(console, 'trace').mockImplementation(() => {});
        const groupEndSpy = jest.spyOn(console, 'groupEnd').mockImplementation(() => {});

        Snowboard.warning('Test message');

        expect(groupCollapsedSpy).not.toHaveBeenCalled();
        expect(traceSpy).not.toHaveBeenCalled();
        expect(groupEndSpy).not.toHaveBeenCalled();
    });

    it('can log error messages', () => {
        const groupCollapsedSpy = jest.spyOn(console, 'groupCollapsed').mockImplementation(() => {});
        const traceSpy = jest.spyOn(console, 'trace').mockImplementation(() => {});
        const groupEndSpy = jest.spyOn(console, 'groupEnd').mockImplementation(() => {});

        Snowboard.error('Test message');

        expect(groupCollapsedSpy).toHaveBeenCalled();
        expect(groupCollapsedSpy).toHaveBeenLastCalledWith('%c[Snowboard]', 'color: rgb(211, 71, 71); font-weight: bold;', 'Test message');
        expect(traceSpy).toHaveBeenCalled();
        expect(groupEndSpy).toHaveBeenCalled();
    });

    it('can log multiple parameters', () => {
        const groupCollapsedSpy = jest.spyOn(console, 'groupCollapsed').mockImplementation(() => {});
        const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
        const traceSpy = jest.spyOn(console, 'trace').mockImplementation(() => {});
        const groupEndSpy = jest.spyOn(console, 'groupEnd').mockImplementation(() => {});

        Snowboard.error('Test message', true, 1);

        expect(groupCollapsedSpy).toHaveBeenCalledTimes(3);
        expect(logSpy).toHaveBeenCalledTimes(2);
        expect(groupCollapsedSpy).toHaveBeenNthCalledWith(1, '%c[Snowboard]', 'color: rgb(211, 71, 71); font-weight: bold;', 'Test message');
        expect(groupCollapsedSpy).toHaveBeenNthCalledWith(2, '%cParameters %c(2)', 'color: rgb(45, 167, 199); font-weight: bold;', 'color: rgb(88, 88, 88); font-weight: normal;');
        expect(logSpy).toHaveBeenNthCalledWith(1, '%c1:', 'color: rgb(88, 88, 88); font-weight: normal;', true);
        expect(logSpy).toHaveBeenNthCalledWith(2, '%c2:', 'color: rgb(88, 88, 88); font-weight: normal;', 1);
        expect(groupCollapsedSpy).toHaveBeenNthCalledWith(3, '%cTrace', 'color: rgb(45, 167, 199); font-weight: bold;');
        expect(traceSpy).toHaveBeenCalled();
        expect(groupEndSpy).toHaveBeenCalled();
    });

    it('can be torn down', () => {
        Snowboard.addPlugin('testDependencyTwo', TestDependencyTwo);
        Snowboard.addPlugin('testHasDependencies', TestHasDependencies);
        Snowboard.addPlugin('testDependencyOne', TestDependencyOne);

        const instance = Snowboard.testHasDependencies();

        expect(Snowboard.plugins.has('testhasdependencies')).toEqual(true);
        expect(Snowboard.plugins.get('testhasdependencies').getInstances()).toEqual([instance]);

        Snowboard.tearDown();

        expect(Snowboard.plugins.has('testhasdependencies')).toEqual(false);
        expect(Snowboard.plugins.get('testhasdependencies')).toBeUndefined();
        expect(instance.destructed).toBe(true);

        expect(Snowboard.plugins.size).toEqual(0);
        expect(Snowboard.abstracts.size).toEqual(0);
        expect(Snowboard.traits.size).toEqual(0);
        expect(Snowboard.listeners.size).toEqual(0);
    });
});
