import { registerDecorator, ValidationOptions, ValidationArguments } from 'class-validator';

export function IsIranianNationalCode(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'isIranianNationalCode',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
          if (value === undefined || value === null || value === '') return true;
          if (typeof value !== 'string') return false;
          if (!/^\d{10}$/.test(value)) return false;
          if (/^(\d)\1{9}$/.test(value)) return false;
          
          const check = parseInt(value[9]);
          const sum = value.split('').slice(0, 9).reduce((acc, curr, i) => acc + parseInt(curr) * (10 - i), 0);
          const rem = sum % 11;
          
          return (rem < 2 && check === rem) || (rem >= 2 && check === 11 - rem);
        },
        defaultMessage(args: ValidationArguments) {
          return 'کد ملی وارد شده معتبر نیست.';
        }
      },
    });
  };
}
