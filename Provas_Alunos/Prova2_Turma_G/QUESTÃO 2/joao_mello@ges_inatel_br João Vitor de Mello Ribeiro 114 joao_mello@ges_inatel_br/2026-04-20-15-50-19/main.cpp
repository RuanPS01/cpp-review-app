#include <iostream>
#include <iomanip>

using namespace std;

int main()
{
    int N; 
    int numeros;
    int soma = 0;
    
    cin >> N;
    
    for(int i = 0; i < N; i++)
    {
        cin >> numeros;
        
        soma += numeros;
    }
    
    double media = soma / (N * 1.0);
    
    cout << fixed << setprecision(4);
    cout << media << endl;
    
    return 0;
    
}