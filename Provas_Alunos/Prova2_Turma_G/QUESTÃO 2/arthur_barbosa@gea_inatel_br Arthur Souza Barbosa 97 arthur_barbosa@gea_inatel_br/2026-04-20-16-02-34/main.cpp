#include <iostream>
#include <iomanip>
using namespace std;

int main()
{
    int n, num, soma=0.0;
    double m;
    cin >> n;
    for(int i=0; i<n;i++)
    {
        cin >> num; 
        soma+=num;
        
    }
    m=soma/(n*1.0);
    
    cout << fixed << setprecision(4);
    cout << m << endl;
    
    return 0;
}