import { Controller, ControllerProps, FieldPath, FieldValues } from 'react-hook-form';
import { Field, FieldContent, FieldDescription, FieldError, FieldLabel } from './ui/field';
import { Input } from './ui/input';
import { ComponentProps, ReactNode } from 'react';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectTrigger, SelectValue } from './ui/select';
import { Checkbox } from './ui/checkbox';

type FormControlProps<
    TFieldValues extends FieldValues = FieldValues,
    TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
    TTransformedValues = TFieldValues,
> = {
    name: TName;
    label: ReactNode;
    description?: ReactNode;
    control: ControllerProps<TFieldValues, TName, TTransformedValues>['control'];
};

type FormBaseProps<
    TFieldValues extends FieldValues = FieldValues,
    TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
    TTransformedValues = TFieldValues,
> = FormControlProps<TFieldValues, TName, TTransformedValues> & {
    horizontal?: boolean;
    controlFirst?: boolean;
    children: (
        field: Parameters<
            ControllerProps<TFieldValues, TName, TTransformedValues>['render']
        >[0]['field'] & {
            'aria-invalid': boolean;
            id: string;
        },
    ) => ReactNode;
};

type FormControlFunc<ExtraProps extends Record<string, unknown> = Record<never, never>> = <
    TFieldValues extends FieldValues = FieldValues,
    TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
    TTransformedValues = TFieldValues,
>(
    props: FormControlProps<TFieldValues, TName, TTransformedValues> & ExtraProps,
) => ReactNode;

function FormBase<
    TFieldValues extends FieldValues = FieldValues,
    TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
    TTransformedValues = TFieldValues,
>({
    children,
    control,
    label,
    name,
    description,
    controlFirst,
    horizontal,
}: FormBaseProps<TFieldValues, TName, TTransformedValues>) {
    return (
        <Controller
            control={control}
            name={name}
            render={({ field, fieldState }) => {
                const labelElement = (
                    <>
                        <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
                        {description && <FieldDescription>{description}</FieldDescription>}
                    </>
                );
                const control = children({
                    ...field,
                    id: field.name,
                    'aria-invalid': fieldState.invalid,
                });
                const errorElem = fieldState.invalid && <FieldError errors={[fieldState.error]} />;

                return (
                    <Field
                        data-invalid={fieldState.invalid}
                        orientation={horizontal ? 'horizontal' : undefined}
                    >
                        {controlFirst ? (
                            <>
                                {control}
                                <FieldContent>
                                    {labelElement}
                                    {errorElem}
                                </FieldContent>
                            </>
                        ) : (
                            <>
                                <FieldContent>{labelElement}</FieldContent>
                                {control}
                                {errorElem}
                            </>
                        )}
                    </Field>
                );
            }}
        />
    );
}

/**
 * Prop được phép chuyển tiếp xuống `<Input>`.
 *
 * Loại bỏ những prop mà `Controller` đã cầm trịch — để lọt qua thì chúng ghi đè lên nhau và ô
 * nhập tách rời khỏi form mà không báo lỗi gì.
 */
type FormInputExtraProps = Omit<
    ComponentProps<typeof Input>,
    'name' | 'value' | 'defaultValue' | 'onChange' | 'onBlur' | 'ref' | 'id'
>;

export const FormInput: FormControlFunc<FormInputExtraProps> = ({
    control,
    name,
    label,
    description,
    ...inputProps
}) => {
    return (
        <FormBase control={control} name={name} label={label} description={description}>
            {/* `field` trải sau `inputProps` để không prop ngoài nào giành được quyền của Controller. */}
            {(field) => <Input {...inputProps} {...field} />}
        </FormBase>
    );
};

type FormTextareaExtraProps = Omit<
    ComponentProps<typeof Textarea>,
    'name' | 'value' | 'defaultValue' | 'onChange' | 'onBlur' | 'ref' | 'id'
>;

export const FormTextarea: FormControlFunc<FormTextareaExtraProps> = ({
    control,
    name,
    label,
    description,
    ...textareaProps
}) => {
    return (
        <FormBase control={control} name={name} label={label} description={description}>
            {(field) => <Textarea {...textareaProps} {...field} />}
        </FormBase>
    );
};

/**
 * `items` ánh xạ giá trị sang nhãn: `{ "<uuid>": "Macquarie University" }`.
 *
 * Không truyền thì `Select.Value` in ra GIÁ TRỊ THÔ khi ô đã có sẵn lựa chọn — người dùng mở
 * biểu mẫu sửa và thấy một chuỗi uuid thay vì tên. Base UI chỉ biết nhãn của một mục sau khi
 * popup mở ra lần đầu; `items` cho nó biết trước.
 */
export const FormSelect: FormControlFunc<{
    children: ReactNode;
    items?: Record<string, ReactNode>;
}> = ({ children, items, ...props }) => {
    return (
        <FormBase {...props}>
            {({ onChange, onBlur, ...field }) => (
                <Select {...field} items={items} onValueChange={onChange}>
                    <SelectTrigger
                        aria-invalid={field['aria-invalid']}
                        id={field.id}
                        onBlur={onBlur}
                    >
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>{children}</SelectContent>
                </Select>
            )}
        </FormBase>
    );
};

export const FormCheckbox: FormControlFunc = (props) => {
    return (
        <FormBase {...props} horizontal controlFirst>
            {({ onChange, value, ...field }) => (
                <Checkbox {...field} checked={value} onCheckedChange={onChange} />
            )}
        </FormBase>
    );
};
