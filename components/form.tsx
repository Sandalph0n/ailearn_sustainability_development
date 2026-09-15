import { Controller, ControllerProps, FieldPath, FieldValues } from 'react-hook-form';
import { Field, FieldContent, FieldDescription, FieldError, FieldLabel } from './ui/field';
import { Input } from './ui/input';
import { ComponentProps, ReactNode } from 'react';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectTrigger, SelectValue } from './ui/select';
import { Checkbox } from './ui/checkbox';
import {
    Combobox,
    ComboboxContent,
    ComboboxEmpty,
    ComboboxInput,
    ComboboxItem,
    ComboboxList,
} from './ui/combobox';

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

export type FormComboboxOption = {
    value: string;
    label: string;
    description?: string;
};

/**
 * Searchable single-value selector for long administrative catalogs.
 *
 * The form stores only the option value while the combobox receives the full option object, so
 * the selected label remains readable without leaking UUIDs into the input.
 */
export const FormCombobox: FormControlFunc<{
    options: FormComboboxOption[];
    placeholder?: string;
    emptyText?: string;
    disabled?: boolean;
}> = ({ options, placeholder, emptyText = 'No matching option.', disabled, ...props }) => {
    return (
        <FormBase {...props}>
            {({ onChange, onBlur, value, ref: _ref, ...field }) => {
                const selected = options.find((option) => option.value === value) ?? null;

                return (
                    <Combobox
                        items={options}
                        value={selected}
                        onValueChange={(option: FormComboboxOption | null) =>
                            onChange(option?.value ?? '')
                        }
                        itemToStringLabel={(option: FormComboboxOption) => option.label}
                        itemToStringValue={(option: FormComboboxOption) => option.value}
                        isItemEqualToValue={(
                            option: FormComboboxOption,
                            current: FormComboboxOption,
                        ) => option.value === current.value}
                        filter={(option: FormComboboxOption, query: string) => {
                            const searchable = `${option.label} ${option.description ?? ''}`;
                            return searchable.toLocaleLowerCase().includes(query.toLocaleLowerCase());
                        }}
                        disabled={disabled}
                    >
                        <ComboboxInput
                            {...field}
                            onBlur={onBlur}
                            className="w-full"
                            placeholder={placeholder}
                            disabled={disabled}
                            showClear={false}
                        />
                        <ComboboxContent>
                            <ComboboxEmpty>{emptyText}</ComboboxEmpty>
                            <ComboboxList>
                                {(option: FormComboboxOption) => (
                                    <ComboboxItem key={option.value} value={option}>
                                        <span className="flex min-w-0 flex-col">
                                            <span className="truncate font-medium">
                                                {option.label}
                                            </span>
                                            {option.description && (
                                                <span className="text-muted-foreground truncate text-xs">
                                                    {option.description}
                                                </span>
                                            )}
                                        </span>
                                    </ComboboxItem>
                                )}
                            </ComboboxList>
                        </ComboboxContent>
                    </Combobox>
                );
            }}
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
