#include <iostream>
#include <iomanip>
using namespace std;

int main()
{
    int N, numero, soma = 0;
    cin >> N;
    
    for (int i = 0; i < N; i++)
    {
        cin >> numero;
        soma += numero;
    }
    
    cout << fixed << setprecision(4);
    cout << (double)soma/N << endl;
    
    return 0;
}