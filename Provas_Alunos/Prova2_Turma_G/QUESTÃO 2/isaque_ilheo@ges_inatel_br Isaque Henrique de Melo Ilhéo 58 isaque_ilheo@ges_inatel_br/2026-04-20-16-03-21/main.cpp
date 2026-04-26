#include <iostream>
#include <iomanip>
using namespace std;

int main()
{
    int quant, num, soma = 0;
    double media = 0;
    
    cin >> quant;
    
    for(int i = 0; i < quant; i++)
    {
        cin >> num;
        soma += num;
    }
    
    media = (double) soma / quant;
    cout << fixed << setprecision(4) << media << endl;
    
    return  0;
}