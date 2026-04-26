#include <iostream>
#include <iomanip>
#include <cmath>
using namespace std;

int main()
{
    int N;
    cin >> N;
    
    int numeros;
    double soma = 0.0;
    
    for(int i = 0; i < N; i++)
    {
        cin >> numeros;
        
        soma += numeros;
    }
    
    double media = (soma/N);
    
    cout << fixed << setprecision(4);
    cout << media << endl;
    
    return 0;
}