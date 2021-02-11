function findLineByLeastSquares(values_x, values_y) {
    let sum_x = 0;
    let sum_y = 0;
    let sum_xy = 0;
    let sum_xx = 0;
    let count = 0;
    /*
     * We'll use those variables for faster read/write access.
     */
    let x = 0;
    let y = 0;
    let values_length = values_x.length;
    if (values_length != values_y.length) {
        throw new Error('The parameters values_x and values_y need to have same size!');
    }
    /*
     * Nothing to do.
     */
    if (values_length === 0) {
        return [[], []];
    }
    /*
     * Calculate the sum for each of the parts necessary.
     */
    for (let v = 0; v < values_length; v++) {
        x = values_x[v];
        y = values_y[v];
        sum_x += x;
        sum_y += y;
        sum_xx += x * x;
        sum_xy += x * y;
        count++;
    }
    /*
     * Calculate m and b for the formular:
     * y = x * m + b
     */
    let m = (count * sum_xy - sum_x * sum_y) / (count * sum_xx - sum_x * sum_x);
    let b = (sum_y / count) - (m * sum_x) / count;
    /*
     * We will make the x and y result line now
     */
    let result_values_x = [];
    let result_values_y = [];
    for (let v = 0; v < values_length; v++) {
        x = values_x[v];
        y = x * m + b;
        result_values_x.push(x);
        result_values_y.push(y);
    }
    return [result_values_x, result_values_y, m, b];
}
function findLineByLeastSquaresNoIntercept(values_x, values_y) {
    let sum_x = 0;
    let sum_x2 = 0;
    let sum_y = 0;
    let sum_xiyi = 0;
    let count = 0;
    /*
     * We'll use those variables for faster read/write access.
     */
    let x = 0;
    let y = 0;
    let values_length = values_x.length;
    if (values_length != values_y.length) {
        throw new Error('The parameters values_x and values_y need to have same size!');
    }
    /*
     * Nothing to do.
     */
    if (values_length === 0) {
        return [[], []];
    }
    /*
     * Calculate the sum for each of the parts necessary.
     */
    for (let v = 0; v < values_length; v++) {
        x = values_x[v];
        y = values_y[v];
        sum_x2 += x * x;
        sum_xiyi += x * y;
        count++;
    }
    /*
     * Calculate m and b for the formular:
     * y = x * m + b
     */
    let m = sum_xiyi / sum_x2;
    /*
     * We will make the x and y result line now
     */
    let result_values_x = [];
    let result_values_y = [];
    for (let v = 0; v < values_length; v++) {
        x = values_x[v];
        y = x * m;
        result_values_x.push(x);
        result_values_y.push(y);
    }
    return [result_values_x, result_values_y, m];
}
