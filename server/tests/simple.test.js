// A simple test file that doesn't require complex dependencies

describe('Basic functionality', () => {
  test('true should be true', () => {
    expect(true).toBe(true);
  });
  
  test('math should work correctly', () => {
    expect(1 + 1).toBe(2);
    expect(5 * 5).toBe(25);
  });
  
  test('strings should concatenate', () => {
    expect('hello' + ' ' + 'world').toBe('hello world');
  });
  
  test('objects should be comparable', () => {
    const obj1 = { name: 'test', value: 123 };
    const obj2 = { ...obj1 };
    
    expect(obj1).toEqual(obj2);
    expect(obj1 === obj2).toBe(false); // Different object references
  });
});